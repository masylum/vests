//! Full rollout physics behind the optional Node accelerator. JavaScript remains
//! the reference; the build must pass exact parity before installing this library.
use std::collections::VecDeque;
use std::ffi::{c_char, c_void};
use std::panic::{catch_unwind, AssertUnwindSafe};

// Rollout temporaries never escape one synchronous Node call. Reuse a bounded
// thread-local arena; oversized allocations use System. Nested calls share the
// outer scope without resetting live storage. All owned values drop first.
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::{Cell, UnsafeCell};
use std::mem::MaybeUninit;
const ARENA_BYTES: usize = 2 * 1024 * 1024;
struct Arena {
    bytes: UnsafeCell<[MaybeUninit<u8>; ARENA_BYTES]>,
    used: Cell<usize>,
    active: Cell<bool>,
}
thread_local! {
    static ARENA: Arena = const { Arena {
        bytes: UnsafeCell::new([MaybeUninit::uninit(); ARENA_BYTES]),
        used: Cell::new(0), active: Cell::new(false),
    } };
}
struct RolloutAllocator;
// Only this library's Rust allocations use the allocator. The Node boundary
// copies results before the scope ends; no Rust-owned pointer crosses that ABI.
unsafe impl GlobalAlloc for RolloutAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = ARENA
            .try_with(|a| {
                if !a.active.get() {
                    return std::ptr::null_mut();
                }
                let base = a.bytes.get() as *mut u8;
                let Some(address) = (base as usize)
                    .checked_add(a.used.get())
                    .and_then(|p| p.checked_add(layout.align() - 1))
                else {
                    return std::ptr::null_mut();
                };
                let at = (address & !(layout.align() - 1)) - base as usize;
                if at > ARENA_BYTES || layout.size() > ARENA_BYTES - at {
                    return std::ptr::null_mut();
                }
                a.used.set(at + layout.size());
                unsafe { base.add(at) }
            })
            .unwrap_or(std::ptr::null_mut());
        if ptr.is_null() {
            unsafe { System.alloc(layout) }
        } else {
            ptr
        }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        let local = ARENA
            .try_with(|a| {
                let start = a.bytes.get() as usize;
                (ptr as usize) >= start && (ptr as usize) < start + ARENA_BYTES
            })
            .unwrap_or(false);
        if !local {
            unsafe {
                System.dealloc(ptr, layout);
            }
        }
    }
}
#[global_allocator]
static ALLOCATOR: RolloutAllocator = RolloutAllocator;
struct ArenaScope(bool);
impl ArenaScope {
    fn enter() -> Self {
        Self(ARENA.with(|a| {
            if a.active.get() {
                return false;
            }
            a.used.set(0);
            a.active.set(true);
            true
        }))
    }
}
impl Drop for ArenaScope {
    fn drop(&mut self) {
        if self.0 {
            ARENA.with(|a| a.active.set(false));
        }
    }
}

#[derive(Clone, Copy, Default)]
struct Card {
    id: i32,
    c: usize,
    p: i32,
    s: i32,
    e: i32,
}
struct Reader<'a> {
    data: &'a [f64],
    at: usize,
}
impl Reader<'_> {
    fn get(&mut self) -> Result<f64, &'static str> {
        let x = *self.data.get(self.at).ok_or("Truncated forecast input")?;
        self.at += 1;
        if !x.is_finite() {
            return Err("Non-finite forecast input");
        }
        Ok(x)
    }
    fn int(&mut self, lo: i32, hi: i32) -> Result<i32, &'static str> {
        let x = self.get()?;
        if x < lo as f64 || x > hi as f64 || x != x.floor() {
            return Err("Invalid forecast integer");
        }
        Ok(x as i32)
    }
    fn card(&mut self) -> Result<Card, &'static str> {
        Ok(Card {
            id: self.int(0, 9999)?,
            c: self.int(0, 7)? as usize,
            p: self.int(-1, 3)?,
            s: self.int(0, 6)?,
            e: self.int(0, 2)?,
        })
    }
    fn cards(&mut self) -> Result<Vec<Card>, &'static str> {
        let n = self.int(0, 256)?;
        (0..n).map(|_| self.card()).collect()
    }
}
#[derive(Clone)]
struct Rules {
    max: i32,
    limit: i32,
    places: i32,
    catchup: bool,
    burn: usize,
    checkpoint_count: i32,
    draws: i32,
    cp: [i32; 3],
    prices: [[f64; 3]; 3],
    slots: [[f64; 3]; 8],
    scale: f64,
    wang: f64,
    unit: f64,
    intel: bool,
    values: [f64; 49],
}
impl Default for Rules {
    fn default() -> Self {
        Self {
            max: 0,
            limit: 0,
            places: 0,
            catchup: false,
            burn: 0,
            checkpoint_count: 0,
            draws: 0,
            cp: [0; 3],
            prices: [[0.; 3]; 3],
            slots: [[0.; 3]; 8],
            scale: 0.,
            wang: 0.,
            unit: 0.,
            intel: false,
            values: [0.; 49],
        }
    }
}
#[derive(Clone, Default)]
struct Company {
    id: usize,
    pos: i32,
    founder: i32,
    reserve: i32,
    arrival: i32,
    supply_count: i32,
    down: bool,
    hiring: bool,
    counts: [i32; 6],
    bank: i32,
    last: [i32; 6],
    supply: Vec<Card>,
}
#[derive(Clone, Default)]
struct Deck {
    unseen: Vec<Card>,
    top: Vec<Card>,
    bottom: Option<Card>,
}
struct Rng(u32);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 = (self.0 ^ (self.0 >> 15)).wrapping_mul(2246822519);
        self.0 as f64 / 4294967296.
    }
    fn mix<T>(&mut self, a: &mut [T]) {
        for i in (1..a.len()).rev() {
            let j = (self.next() * (i + 1) as f64) as usize;
            a.swap(i, j);
        }
    }
}
#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Move,
    Fumble,
    Jobs,
    Leon,
    Follow,
    After,
    RepairOffer,
    Repair,
    Add,
    Transfer,
    Swap,
    Julie,
    ReidOffer,
    ReidReturn,
    Base,
}
#[derive(Clone, Copy)]
struct Action {
    kind: Kind,
    c: usize,
    t: usize,
    amount: i32,
    dest: i32,
    source: i32,
}
impl Action {
    fn new(kind: Kind, c: usize) -> Self {
        Self {
            kind,
            c,
            t: 0,
            amount: 0,
            dest: -1,
            source: -1,
        }
    }
    fn target(kind: Kind, c: usize, t: usize) -> Self {
        Self {
            t,
            ..Self::new(kind, c)
        }
    }
    fn amount(kind: Kind, c: usize, amount: i32) -> Self {
        Self {
            amount,
            ..Self::new(kind, c)
        }
    }
    fn source(kind: Kind, c: usize, source: usize) -> Self {
        Self {
            source: source as i32,
            ..Self::new(kind, c)
        }
    }
}
fn movement(c: usize, amount: i32, source: i32, dest: i32) -> Action {
    Action {
        amount,
        source,
        dest,
        ..Action::new(Kind::Move, c)
    }
}
#[derive(Clone, Default)]
struct State {
    r: Rules,
    n: usize,
    p: usize,
    leg: usize,
    ipo: i32,
    serial: i32,
    c: Vec<Company>,
    ordered: Vec<usize>,
    pile: Vec<Card>,
    returning: Vec<Card>,
    used: [bool; 8],
    harry: [bool; 8],
    julie: [bool; 8],
    moved: [bool; 8],
    stage: i32,
    generation: i32,
    ownership_generation: i32,
    owners: [i32; 8],
    denominators: [i32; 8],
    numerators: [[f64; 6]; 8],
    current: Card,
    physical: Card,
    deferred: bool,
    returned: bool,
    q: VecDeque<Action>,
    engine_rng: u32,
    engine_init: bool,
}
impl State {
    fn shares(&self, cid: usize) -> i32 {
        self.c[cid].bank + self.c[cid].counts[..self.p].iter().sum::<i32>()
    }
    fn ownership(&mut self) {
        if self.ownership_generation == self.generation {
            return;
        }
        for cid in 0..self.n {
            let x = &self.c[cid];
            let (mut count, mut best, mut total) = (0, -1_i32, 0);
            for p in 0..self.p {
                let n = x.counts[p];
                total += n;
                if n > count || (n != 0 && n == count && x.last[p] > x.last[best as usize]) {
                    best = p as i32;
                    count = n;
                }
            }
            self.owners[cid] = best;
            self.denominators[cid] = (total + x.bank).max(1);
            for p in 0..self.p {
                self.numerators[cid][p] = x.counts[p] as f64 - 0.3 * (total - x.counts[p]) as f64;
            }
        }
        self.ownership_generation = self.generation;
    }
    fn owner(&mut self, cid: usize) -> i32 {
        self.ownership();
        self.owners[cid]
    }
    fn leading(&self, cid: usize) -> bool {
        self.c.iter().all(|x| x.pos <= self.c[cid].pos)
    }
    fn rank(&self, cid: usize) -> i32 {
        let c = &self.c[cid];
        1 + self
            .c
            .iter()
            .filter(|x| {
                x.pos > c.pos
                    || (x.pos == c.pos
                        && (x.arrival < c.arrival || (x.arrival == c.arrival && x.id < cid)))
            })
            .count() as i32
    }
    fn cv(&self, pos: f64) -> f64 {
        self.r.values[((pos * 2.) as i32).clamp(0, 48) as usize]
    }
    fn whole(&self, cid: usize) -> f64 {
        let k = self.rank(cid);
        let x = &self.c[cid];
        if x.founder == 4 && !x.down && !x.hiring && k == self.n as i32 - 1 {
            self.r.wang
        } else {
            self.cv(x.pos as f64)
        }
    }
    fn payout(&self, cid: usize) -> f64 {
        self.r.scale * (self.whole(cid) / self.shares(cid).max(1) as f64 / self.r.scale).floor()
    }
    fn during(&self) -> bool {
        self.stage == 0
    }
    fn front<I>(&mut self, actions: I)
    where
        I: IntoIterator<Item = Action>,
        I::IntoIter: DoubleEndedIterator,
    {
        for a in actions.into_iter().rev() {
            self.q.push_front(a);
        }
    }
    fn value(&self, cid: usize, from: f64, to: f64, player: usize) -> f64 {
        let price = self.cv(to) - self.cv(from)
            + (to - from) * self.cv(self.r.cp[2] as f64) / self.r.cp[2] as f64 * 0.2;
        price * self.numerators[cid][player] / self.denominators[cid] as f64
    }
    fn score(&self, actions: &[Action], p: usize) -> f64 {
        let mut out = 0.;
        for a in actions {
            let x = &self.c[a.c];
            let pos = x.pos;
            let val = |cid, from: i32, to: i32| self.value(cid, from as f64, to as f64, p);
            match a.kind {
                Kind::Move => {
                    out += val(
                        a.c,
                        pos,
                        if a.dest >= 0 {
                            a.dest
                        } else {
                            self.r.cp[2].min(pos + a.amount)
                        },
                    )
                }
                Kind::Swap => {
                    out += val(a.c, pos, self.c[a.t].pos) + val(a.t, self.c[a.t].pos, pos)
                }
                Kind::Transfer => {
                    let t = &self.c[a.t];
                    out += val(
                        a.t,
                        t.pos,
                        24.min(
                            t.pos
                                + if t.reserve < 3 {
                                    self.r.slots[a.t][t.reserve as usize] as i32
                                } else {
                                    0
                                },
                        ),
                    );
                    out -= val(
                        a.c,
                        pos,
                        24.min(
                            pos + if x.reserve != 0 {
                                self.r.slots[a.c][x.reserve as usize - 1] as i32
                            } else {
                                0
                            },
                        ),
                    );
                }
                Kind::Fumble if !x.down => {
                    if x.founder == 11 && !x.hiring && self.during() {
                        out += val(a.c, pos, 24.min(pos + 2));
                    } else {
                        out -= 0.7 * self.value(a.c, pos as f64, 24_f64.min(pos as f64 + 1.5), p);
                        for t in &self.c {
                            if t.id != a.c && t.founder == 5 && !t.down && !t.hiring {
                                out += val(t.id, t.pos, 24.min(t.pos + 1));
                            }
                        }
                    }
                }
                Kind::Repair if x.down => {
                    out += 0.7 * self.value(a.c, pos as f64, 24_f64.min(pos as f64 + 1.5), p)
                }
                Kind::Add if x.supply_count != 0 => {
                    out += self.value(
                        a.c,
                        pos as f64,
                        24_f64.min(pos as f64 + 1.5 * a.amount.min(x.supply_count) as f64),
                        p,
                    )
                }
                Kind::Julie => {
                    let impact = |cid: usize| {
                        let t=&self.c[cid];
                        if t.down && self.current.s!=3 {
                            0.7*self.value(cid,t.pos as f64,24_f64.min(t.pos as f64+1.5),p)
                        } else if self.current.e==1 {
                            if t.founder==11 {val(cid,t.pos,24.min(t.pos+2))}
                            else {-0.7*self.value(cid,t.pos as f64,24_f64.min(t.pos as f64+1.5),p)}
                        } else {
                            let amount=if self.current.s==6 {if self.leading(cid) {1} else {3}}
                            else {self.current.p+i32::from(t.founder==8&&!self.leading(cid))};
                            val(cid,t.pos,24.min(t.pos+amount))
                        }
                    };
                    out+=impact(a.c)-impact(self.current.c)-0.2;
                }
                Kind::ReidReturn => {
                    out+=0.5*self.value(a.c,pos as f64,24_f64.min(pos as f64+1.5),p);
                }
                _ => {}
            }
        }
        out
    }
    fn offer(&mut self, cid: usize, mut options: Vec<Vec<Action>>, mandatory: bool) {
        let p = self.owner(cid);
        if p < 0 {
            return;
        }
        let mut best = if mandatory { f64::NEG_INFINITY } else { 0. };
        let mut chosen = None;
        for (i, a) in options.iter().enumerate() {
            let score = self.score(a, p as usize);
            if score > best {
                best = score;
                chosen = Some(i);
            }
        }
        if let Some(i) = chosen {
            self.front(options.swap_remove(i));
        }
    }
    fn reactions(&mut self, moves: &[(usize, i32, i32)]) {
        for &(id, from, to) in moves {
            if from != to {
                self.moved[id] = true;
            }
        }
        let mut actions = Vec::new();
        for &cid in &self.ordered {
            let x = &self.c[cid];
            if (self.used[cid] && x.founder != 12) || x.hiring || x.down {
                continue;
            }
            let (mut landed, mut own) = (false, false);
            for &(id, from, to) in moves {
                if id != cid {
                    if from != to && to == x.pos {
                        landed = true;
                    }
                    if x.founder == 10 && from <= x.pos && to > x.pos {
                        actions.push(Action::target(Kind::Leon, cid, id));
                    }
                } else if from != to {
                    own = true;
                }
            }
            if x.founder == 0 && landed {
                actions.push(Action::new(Kind::Jobs, cid));
            }
            if x.founder == 12 && own && self.c.iter().any(|t| t.id != cid && t.pos == x.pos) {
                actions.push(Action::new(Kind::Follow, cid));
            }
        }
        self.front(actions);
    }
    fn destination(&self,cid:usize,from:i32,to:i32)->i32 {
        if to<=from {return to;}
        self.c.iter().filter(|x|x.id!=cid&&x.founder==20&&x.down&&x.pos>=from&&x.pos<to).map(|x|x.pos).min().unwrap_or(to)
    }
    fn moves(&mut self, actions: &[Action]) {
        let mut moves = Vec::new();
        for a in actions {
            let before = self.c[a.c].pos;
            let destination = (if a.dest >= 0 {
                a.dest
            } else {
                before + a.amount
            })
            .clamp(0, self.r.cp[2]);
            self.c[a.c].pos=self.destination(a.c,before,destination);
            moves.push((a.c, before, self.c[a.c].pos));
            if self.ipo < 0 && self.c[a.c].pos >= self.r.cp[2] {
                self.ipo = a.c as i32;
            }
        }
        let mut changed: Vec<_> = moves.iter().copied().filter(|m| m.1 != m.2).collect();
        changed.sort_by(|a, b| {
            self.c[a.0]
                .arrival
                .cmp(&self.c[b.0].arrival)
                .then_with(|| b.0.cmp(&a.0))
        });
        for (id, _, _) in changed {
            self.serial += 1;
            self.c[id].arrival = self.serial;
        }
        self.reactions(&moves);
    }
    fn engine_random(&mut self) -> f64 {
        if !self.engine_init {
            self.engine_init = true;
            return 0.;
        }
        self.engine_rng = self.engine_rng.wrapping_add(0x6d2b79f5);
        let mut t = (self.engine_rng ^ (self.engine_rng >> 15)).wrapping_mul(self.engine_rng | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        (t ^ (t >> 14)) as f64 / 4294967296.
    }
    fn engine_shuffle(&mut self) {
        for i in (1..self.pile.len()).rev() {
            let j = (self.engine_random() * (i + 1) as f64) as usize;
            self.pile.swap(i, j);
        }
    }
    fn drain(&mut self) {
        let mut work = 0;
        while let Some(a) = self.q.pop_front() {
            work += 1;
            assert!(work <= 512, "Native founder chain did not terminate");
            let cid = a.c;
            match a.kind {
                Kind::Move => self.moves(&[a]),
                Kind::Swap => {
                    let (from, to) = (self.c[cid].pos, self.c[a.t].pos);
                    self.moves(&[movement(cid, 0, -1, to), movement(a.t, 0, -1, from)]);
                }
                Kind::Jobs | Kind::Leon | Kind::Follow => {
                    if self.c[cid].down || self.c[cid].hiring {
                        continue;
                    }
                    if a.kind != Kind::Follow {
                        if self.used[cid] {
                            continue;
                        }
                        self.used[cid] = true;
                    }
                    match a.kind {
                        Kind::Jobs => self.front([movement(cid, 2, cid as i32, -1)]),
                        Kind::Leon => self.front([
                            Action::source(Kind::Fumble, a.t, cid),
                            movement(cid, 1, cid as i32, -1),
                        ]),
                        _ => self.front([movement(cid, 1, cid as i32, -1)]),
                    }
                }
                Kind::Fumble => {
                    if self.c[cid].founder == 11
                        && !self.c[cid].down
                        && !self.c[cid].hiring
                        && self.during()
                    {
                        self.front([movement(cid, 2, cid as i32, -1)]);
                        continue;
                    }
                    if self.c[cid].down {
                        continue;
                    }
                    self.c[cid].down = true;
                    let mut responses = Vec::new();
                    for &id in &self.ordered {
                        let t = &self.c[id];
                        if t.down || t.hiring {
                            continue;
                        }
                        if t.founder == 5 {
                            responses.push(movement(id, 1, id as i32, -1));
                        }
                        if id != cid && t.founder == 9 && self.during() {
                            responses.push(Action::target(Kind::RepairOffer, id, cid));
                        }
                    }
                    self.front(responses);
                }
                Kind::RepairOffer => {
                    if !self.during()
                        || !self.c[a.t].down
                        || self.c[cid].down
                        || self.c[cid].hiring
                        || self.harry[cid]
                    {
                        continue;
                    }
                    self.offer(
                        cid,
                        vec![vec![
                            Action::source(Kind::Repair, a.t, cid),
                            Action::amount(Kind::Add, cid, 2),
                        ]],
                        false,
                    );
                }
                Kind::Repair => {
                    if a.source >= 0 && self.c[a.source as usize].founder == 9 {
                        self.harry[a.source as usize] = true;
                    }
                    self.c[cid].down = false;
                    self.c[cid].hiring = false;
                }
                Kind::Add => {
                    let n = (a.amount as usize).min(self.c[cid].supply.len());
                    self.pile.extend(self.c[cid].supply.drain(..n));
                }
                Kind::Transfer => {
                    if !self.c[cid].down
                        && !self.c[cid].hiring
                        && self.c[cid].reserve != 0
                        && self.c[a.t].reserve < 3
                    {
                        self.c[cid].reserve -= 1;
                        self.c[a.t].reserve += 1;
                    }
                }
                Kind::After => {
                    if self.current.s == 5 {
                        let mut targets: Vec<_> = self
                            .c
                            .iter()
                            .filter(|t| {
                                t.id != cid
                                    && t.pos > self.c[cid].pos
                                    && t.pos - self.c[cid].pos <= 2
                            })
                            .map(|t| t.id)
                            .collect();
                        if targets.is_empty() {
                            continue;
                        }
                        if self.owner(cid) < 0 {
                            targets.sort_by(|&i, &j| {
                                self.c[j]
                                    .pos
                                    .cmp(&self.c[i].pos)
                                    .then_with(|| self.c[i].arrival.cmp(&self.c[j].arrival))
                            });
                            self.front([Action::target(Kind::Swap, cid, targets[0])]);
                        } else {
                            self.offer(
                                cid,
                                targets
                                    .into_iter()
                                    .map(|t| vec![Action::target(Kind::Swap, cid, t)])
                                    .collect(),
                                true,
                            );
                        }
                    }
                }
                Kind::Julie => {
                    self.julie[cid]=true;
                    self.current.c=cid;
                }
                Kind::ReidOffer => {
                    if self.c[cid].founder!=21 || self.c[cid].down || self.c[cid].hiring || (self.physical.s==4&&!self.deferred) {continue;}
                    let opts=self.ordered.iter().filter(|&&t|t!=cid).map(|&t|vec![Action::new(Kind::ReidReturn,cid),movement(t,-1,cid as i32,-1)]).collect();
                    self.offer(cid,opts,false);
                }
                Kind::ReidReturn => {
                    self.c[cid].supply.push(self.physical);
                }
                Kind::Base => {
                    let id = self.current.c;
                    let card = self.current;
                    if self.c[id].down && card.s != 3 {
                        self.c[id].down = false;
                        self.c[id].hiring = false;
                        self.deferred = true;
                        self.q.push_front(Action::new(Kind::ReidOffer,self.physical.c));
                        continue;
                    }
                    let before = self.c[id].pos;
                    if card.e != 0 {
                        if card.e == 2 {
                            self.c[id].pos = 0.max(self.c[id].pos - 1);
                        }
                    } else {
                        let bonus = i32::from(
                            self.c[id].founder == 8 && !self.c[id].hiring && !self.leading(id),
                        );
                        let printed = if card.s == 6 {
                            if self.leading(id) {
                                1
                            } else {
                                3
                            }
                        } else {
                            card.p
                        };
                        self.c[id].pos = self.destination(id,before,self.r.cp[2].min(self.c[id].pos + 0.max(printed + bonus)));
                        self.c[id].down = false;
                        if card.s == 4 {
                            self.returning.push(self.physical);
                        }
                    }
                    if card.s == 1 {
                        if !self.c[id].supply.is_empty() {
                            self.pile.push(self.c[id].supply.remove(0));
                        }
                        self.engine_shuffle();
                    }
                    if card.s == 2 {
                        self.c[id].reserve = 3.min(self.c[id].reserve + 1);
                    }
                    let to = self.c[id].pos;
                    if to != before {
                        self.serial += 1;
                        self.c[id].arrival = self.serial;
                    }
                    if self.ipo < 0 && to >= self.r.cp[2] {
                        self.ipo = id as i32;
                    }
                    self.front([Action::new(Kind::After,id),Action::new(Kind::ReidOffer,self.physical.c)]);
                    self.reactions(&[(id, before, to)]);
                    if card.e == 1 {
                        self.q.push_front(Action::new(Kind::Fumble, id));
                    }
                }
            }
        }
    }
    fn phase(&mut self, kind: i32) {
        self.stage = kind;
        self.q.clear();
        if kind == 1 {
            self.harry.fill(false);
            self.julie.fill(false);
        }
        for oi in 0..self.ordered.len() {
            let cid = self.ordered[oi];
            if kind == 3 {
                break;
            }
            if self.c[cid].down || self.c[cid].hiring {
                continue;
            }
            let f = self.c[cid].founder;
            let mut opts = Vec::new();
            if kind == 1 {
                if f == 1 && !self.used[cid] && !self.leading(cid) {
                    self.used[cid] = true;
                    self.offer(
                        cid,
                        vec![vec![
                            movement(cid, 2, cid as i32, -1),
                            Action::source(Kind::Fumble, cid, cid),
                        ]],
                        false,
                    );
                }
                if f == 13 && !self.used[cid] {
                    self.used[cid] = true;
                    self.front([movement(cid, 1, cid as i32, -1)]);
                } else if f == 14 && !self.used[cid] {
                    self.used[cid] = true;
                    self.front([Action::amount(Kind::Add, cid, 1)]);
                } else if f == 6 && !self.used[cid] && !self.leading(cid) {
                    self.used[cid] = true;
                    let leaders:Vec<_>=self.ordered.iter().copied().filter(|&t|self.leading(t)).collect();
                    let mut actions=vec![movement(cid,1,cid as i32,-1)];
                    actions.extend(leaders.into_iter().map(|t|Action::source(Kind::Fumble,t,cid)));
                    self.front(actions);
                } else if (f == 15 || f == 18 || f == 19) && !self.used[cid] {
                    self.used[cid] = true;
                    if f == 15 {
                        for &t in &self.ordered {
                            if t != cid
                                && self.c[t].pos != self.c[cid].pos
                                && (self.c[t].pos - self.c[cid].pos).abs() <= 3
                            {
                                opts.push(vec![
                                    movement(t, 0, cid as i32, self.c[cid].pos),
                                    Action::source(Kind::Fumble, t, cid),
                                ]);
                            }
                        }
                    }
                    if f == 18 && self.c[cid].reserve != 0 {
                        for &t in &self.ordered {
                            if t != cid && self.c[t].reserve < 3 {
                                opts.push(vec![
                                    Action::target(Kind::Transfer, cid, t),
                                    movement(cid, 3, cid as i32, -1),
                                ]);
                            }
                        }
                    }
                    if f == 19 {
                        let next = self
                            .c
                            .iter()
                            .filter(|t| t.id != cid && t.pos > self.c[cid].pos)
                            .map(|t| t.pos)
                            .min();
                        if let Some(next) = next {
                            let mut a = vec![
                                movement(cid, 0, cid as i32, next),
                                Action::source(Kind::Fumble, cid, cid),
                            ];
                            for t in &self.c {
                                if t.id != cid && t.pos == next {
                                    a.push(Action::source(Kind::Fumble, t.id, cid));
                                }
                            }
                            opts.push(a);
                        }
                    }
                    self.offer(cid, opts, false);
                } else if f == 2 && !self.used[cid] {
                    self.used[cid] = true;
                    for &t in &self.ordered {
                        if t != cid
                            && (self.c[t].pos - self.c[cid].pos).abs() > 0
                            && (self.c[t].pos - self.c[cid].pos).abs() <= 3
                        {
                            opts.push(vec![Action::target(Kind::Swap, cid, t)]);
                        }
                    }
                    self.offer(cid, opts, false);
                }
            } else {
                if f == 3 && !self.used[cid] {
                    self.used[cid] = true;
                    for &t in &self.ordered {
                        if t != cid {
                            opts.push(vec![
                                movement(t, 1, cid as i32, -1),
                                movement(cid, 1, cid as i32, -1),
                            ]);
                        }
                    }
                    self.offer(cid, opts, false);
                }
            }
            self.drain();
        }
        if kind == 3 {
            let last = self.c.iter().map(|x| x.pos).min().unwrap();
            let a: Vec<_> = self
                .c
                .iter()
                .filter(|x| x.pos == last)
                .map(|x| movement(x.id, 1, -1, -1))
                .collect();
            self.moves(&a);
            self.drain();
        }
    }
    fn purchase(&mut self, cid: usize, p: usize) {
        let x = &self.c[cid];
        if x.founder != 7
            || x.down
            || x.hiring
            || x.counts[p] == 0
        {
            return;
        }
        self.stage = 4;
        self.q.clear();
        let amount=3-self.c[cid].counts[..self.p].iter().filter(|&&n|n>0).count() as i32;
        self.front([movement(cid, amount, cid as i32, -1)]);
        self.drain();
    }
    fn reveal(&mut self, k: Card) {
        self.stage = 0;
        self.current = k;
        self.physical=k;
        self.deferred = false;
        self.returned = false;
        self.q.clear();
        for oi in 0..self.ordered.len() {
            let id = self.ordered[oi];
            let x = &self.c[id];
            if id == k.c || x.founder != 16 || x.down || x.hiring || self.julie[id] || self.owner(id) < 0 {
                continue;
            }
            self.offer(id, vec![vec![Action::new(Kind::Julie, id)]], false);
            if !self.q.is_empty() {
                self.drain();
                if self.returned {
                    return;
                }
            }
        }
        self.front([Action::new(Kind::Base, self.current.c)]);
        self.drain();
    }
}
struct Input {
    base: State,
    decks: Vec<Deck>,
    samples: usize,
    start_leg: usize,
    auction: i32,
    winner: i32,
    paid: i32,
    delay: i32,
    seed: u32,
    upper: bool,
    locked: bool,
    pool_count: usize,
    sample_start: u32,
    sample_mask: u32,
    independent: bool,
    rate: f64,
    weights: Vec<usize>,
    called: Vec<bool>,
    value_used: Vec<bool>,
    initial_used: Vec<bool>,
    cash: Vec<f64>,
    locked_prices: Vec<f64>,
}
fn decode(r: &mut Reader<'_>) -> Result<Input, &'static str> {
    let mut s = State {
        ipo: -1,
        ownership_generation: -1,
        ..State::default()
    };
    s.n = r.int(1, 8)? as usize;
    s.p = r.int(1, 6)? as usize;
    let samples = r.int(1, 128)? as usize;
    let start_leg = r.int(0, 2)? as usize;
    s.leg = start_leg;
    let _cycle = r.int(0, 1000)?;
    let _player = r.int(0, s.p as i32 - 1)?;
    let seed = r.get()?;
    if !(0. ..=4294967295.).contains(&seed) || seed != seed.floor() {
        return Err("Invalid forecast seed");
    }
    let auction = r.int(-1, s.n as i32 - 1)?;
    let winner = r.int(-1, s.p as i32 - 1)?;
    if winner >= 0 && auction < 0 {
        return Err("Auction winner requires a company");
    }
    let paid = r.int(0, 1000000)?;
    let delay = r.int(0, 10000)?;
    s.ipo = r.int(-1, s.n as i32 - 1)?;
    let upper = r.int(0, 1)? != 0;
    let pool_count = r.int(0, 256)? as usize;
    let locked = r.int(0, 1)? != 0;
    let rate = r.get()?;
    let z = &mut s.r;
    z.max = r.int(1, 100)?;
    z.limit = r.int(1, 100)?;
    z.places = r.int(1, s.n as i32)?;
    z.catchup = r.int(0, 1)? != 0;
    z.burn = r.int(0, 256)? as usize;
    z.checkpoint_count = r.int(1, s.n as i32)?;
    z.draws = r.int(1, 256)?;
    for x in &mut z.cp {
        *x = r.int(1, 24)?;
    }
    let quad = r.int(0, 1)? != 0;
    let mult = r.get()?;
    z.scale = r.get()?;
    let ipo = r.get()?;
    let linear = r.get()?;
    let exit_scale = r.get()?;
    z.wang = r.get()?;
    z.unit = r.get()?;
    z.intel = r.int(0, 1)? != 0;
    if z.scale <= 0. || z.unit <= 0. {
        return Err("Invalid currency scale");
    }
    for i in 0..49 {
        let pos = i as f64 / 2.;
        z.values[i] = if quad {
            let t = 0_f64.max(24_f64.min(pos) - 8.) / 16.;
            mult * z.scale * (ipo / z.scale * t * t + 0.5).floor()
        } else if linear != 0. {
            (linear * 0_f64.max(pos - 4.) + 0.5).floor()
        } else {
            let g = 0_f64.max(pos - 3.);
            exit_scale * ((g * g + 3. * g) / 2. / 5.).floor() * 5.
        };
    }
    for row in &mut z.prices {
        for x in row {
            *x = r.get()?;
        }
    }
    let cash = (0..s.p).map(|_| r.get()).collect::<Result<Vec<_>, _>>()?;
    let value_used = (0..s.p)
        .map(|_| r.int(0, 1).map(|x| x != 0))
        .collect::<Result<Vec<_>, _>>()?;
    let (mut initial_used, mut called, mut weights, mut locked_prices) =
        (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for _ in 0..s.n {
        initial_used.push(r.int(0, 1)? != 0);
        called.push(r.int(0, 1)? != 0);
        weights.push(r.int(0, 256)? as usize);
        locked_prices.push(r.get()?);
    }
    let mut decks = Vec::new();
    for i in 0..s.n {
        let mut x = Company {
            id: i,
            ..Company::default()
        };
        x.pos = r.int(0, 24)?;
        x.founder = r.int(-1, 21)?;
        x.reserve = r.int(0, 3)?;
        x.arrival = r.int(0, 100000)?;
        s.serial = s.serial.max(x.arrival);
        x.supply_count = r.int(0, 256)?;
        x.down = r.int(0, 1)? != 0;
        x.hiring = r.int(0, 1)? != 0;
        for j in 0..s.p {
            x.counts[j] = r.int(0, 100)?;
        }
        x.bank = r.int(0, 100)?;
        for j in 0..s.p {
            x.last[j] = r.int(0, 100000)?;
        }
        for slot in &mut s.r.slots[i] {
            *slot = r.get()?;
        }
        let unseen = r.cards()?;
        let known = r.int(0, 1)? != 0;
        let top = r.cards()?;
        let bottom = if known { Some(r.card()?) } else { None };
        decks.push(Deck {
            unseen,
            top,
            bottom,
        });
        s.c.push(x);
    }
    s.returning = r.cards()?;
    let independent = r.int(0, 1)? != 0;
    let sample_start = r.int(0, 1000000)? as u32;
    let sample_mask = r.int(0, 1073741823)? as u32;
    if sample_mask != 0 && (samples > 30 || !independent || sample_mask > (1u32 << samples) - 1) {
        return Err("Unsupported sparse forecast");
    }
    if decks
        .iter()
        .flat_map(|d| d.unseen.iter().chain(&d.top).chain(d.bottom.iter()))
        .chain(&s.returning)
        .any(|k| k.c >= s.n)
    {
        return Err("Invalid forecast card company");
    }
    let split = s.n.div_ceil(2);
    s.ordered.extend(0..split);
    s.ordered.extend((split..s.n).rev());
    if r.at != r.data.len() {
        return Err("Unexpected forecast data");
    }
    Ok(Input {
        base: s,
        decks,
        samples,
        start_leg,
        auction,
        winner,
        paid,
        delay,
        seed: seed as u32,
        upper,
        locked,
        pool_count,
        sample_start,
        sample_mask,
        independent,
        rate,
        weights,
        called,
        value_used,
        initial_used,
        cash,
        locked_prices,
    })
}
fn funding_need(s: &State, cid: usize, cache: &mut [f64; 8]) -> f64 {
    if cache[cid] >= 0. {
        return cache[cid];
    }
    let x = &s.c[cid];
    if x.supply_count == 0 || x.reserve >= 3 {
        return 0.;
    }
    let pending = s.pile.iter().filter(|k| k.c == cid).count();
    let furthest = s.c.iter().map(|c| c.pos).max().unwrap();
    let rounds = 1_f64.max((24 - furthest) as f64 / 2.);
    let target = (x.supply_count as f64).min(2_f64.max(4_f64.min(rounds)));
    let mut reserved = 0.;
    for j in 0..x.reserve as usize {
        reserved += s.r.slots[cid][j];
    }
    cache[cid] = 0_f64.max(target - pending as f64 - reserved);
    cache[cid]
}
fn band(pos: i32) -> usize {
    ((pos - 1) / 8).clamp(0, 2) as usize
}
fn simulate(input: &Input) -> Vec<f64> {
    let mut out = Vec::new();
    let mut rng = Rng(input.seed);
    for sample in 0..input.samples {
        if input.sample_mask != 0 && input.sample_mask & (1 << sample) == 0 {
            continue;
        }
        if input.independent {
            rng.0 = input
                .seed
                .wrapping_add((sample as u32 + input.sample_start).wrapping_mul(0x9e3779b9));
        }
        let mut s = input.base.clone();
        let mut cash = input.cash.clone();
        let mut spending = vec![0.; s.p];
        for i in 0..s.n {
            let deck = &input.decks[i];
            let mut unseen = deck.unseen.clone();
            rng.mix(&mut unseen);
            let n = input.weights[i].min(unseen.len());
            s.pile.extend(unseen.drain(..n));
            if let Some(bottom) = deck.bottom {
                s.c[i].supply = deck.top.clone();
                let take = s.c[i].supply_count - deck.top.len() as i32 - 1;
                let take = if take < 0 {
                    (unseen.len() as i32 + take).max(0) as usize
                } else {
                    take as usize
                };
                s.c[i]
                    .supply
                    .extend_from_slice(&unseen[..take.min(unseen.len())]);
                s.c[i].supply.push(bottom);
            } else {
                let n = (s.c[i].supply_count as usize).min(unseen.len());
                s.c[i].supply.extend_from_slice(&unseen[..n]);
            }
        }
        if input.upper {
            rng.mix(&mut s.pile);
            let n = s.pile.len().saturating_sub(input.pool_count);
            s.pile.drain(..n);
        }
        s.used[..s.n].copy_from_slice(&input.initial_used);
        if input.winner >= 0 {
            let cid = input.auction as usize;
            let winner = input.winner as usize;
            s.c[cid].counts[winner] += 1;
            s.generation += 1;
            s.c[cid].last[winner] = 1 + s.c[cid].last[..s.p].iter().copied().max().unwrap_or(0);
            let slots = s.r.prices[band(s.c[cid].pos)]
                .iter()
                .filter(|&&price| input.paid as f64 >= price)
                .count() as i32;
            s.c[cid].reserve = 3.min(s.c[cid].reserve + slots);
            cash[winner] -= input.paid as f64;
            s.purchase(cid, winner);
        }
        let initial_shares: Vec<_> = s.c.iter().map(|x| x.counts).collect();
        let mut paths: Vec<Vec<f64>> = vec![Vec::new(); s.n];
        let mut wholes = paths.clone();
        let (mut elapsed, mut end_leg) = (0, 2);
        for leg in input.start_leg..3 {
            s.leg = leg;
            let locked = leg == input.start_leg && input.locked;
            if !locked {
                for cycle in 0..s.r.max {
                    if leg != input.start_leg || cycle > 0 {
                        s.used.fill(false);
                    }
                    elapsed += 1;
                    let candidates: Vec<_> =
                        s.c.iter()
                            .filter(|x| !x.supply.is_empty() && s.shares(x.id) < s.r.limit)
                            .map(|x| x.id)
                            .collect();
                    let mut need_cache = [-1.; 8];
                    let mut players: Vec<_> = (0..s.p).collect();
                    rng.mix(&mut players);
                    for p in players {
                        let mut raises = Vec::new();
                        for &cid in &candidates {
                            let owner = s.owner(cid);
                            if funding_need(&s, cid, &mut need_cache) > 0.
                                && s.c[cid].reserve < 3
                                && (owner == p as i32 || owner < 0)
                                && !(leg == input.start_leg
                                    && cycle == 0
                                    && (input.called[cid] || cid as i32 == input.auction))
                            {
                                raises.push(cid);
                            }
                        }
                        rng.mix(&mut raises);
                        if raises.is_empty() {
                            continue;
                        }
                        let cid = raises[0];
                        if !(elapsed > input.delay && rng.next() < input.rate) {
                            continue;
                        }
                        let minimum = s.r.prices[band(s.c[cid].pos)][0];
                        let buyers: Vec<_> = (0..s.p).filter(|&j| cash[j] >= minimum).collect();
                        if buyers.is_empty() {
                            continue;
                        }
                        let owner = buyers[(rng.next() * buyers.len() as f64) as usize];
                        let slots = (3 - s.c[cid].reserve).min(
                            1.max((funding_need(&s, cid, &mut need_cache) / 2.).ceil() as i32),
                        );
                        let pay = (cash[owner]
                            .min(minimum.max(s.r.prices[band(s.c[cid].pos)][slots as usize - 1]))
                            / s.r.unit)
                            .floor()
                            * s.r.unit;
                        let added = s.r.prices[band(s.c[cid].pos)]
                            .iter()
                            .filter(|&&price| pay >= price)
                            .count() as i32;
                        s.c[cid].reserve = 3.min(s.c[cid].reserve + added);
                        cash[owner] -= pay;
                        spending[owner] += pay;
                        s.c[cid].counts[owner] += 1;
                        s.generation += 1;
                        s.c[cid].last[owner] = cycle + 100;
                        s.purchase(cid, owner);
                        need_cache.fill(-1.);
                    }
                    if s.r.intel && s.c.iter().any(|x| x.founder == 17) {
                        for p in 0..s.p {
                            s.harry.fill(false);
                            let portfolio: Vec<_> =
                                s.c.iter()
                                    .filter(|x| x.counts[p] != 0)
                                    .map(|x| x.id)
                                    .collect();
                            if !portfolio.is_empty()
                                && rng.next() < 0.5
                                && !(leg == input.start_leg && cycle == 0 && input.value_used[p])
                            {
                                let target =
                                    portfolio[(rng.next() * portfolio.len() as f64) as usize];
                                let x = &s.c[target];
                                if x.founder == 17 && !x.down && !x.hiring {
                                    s.stage = 4;
                                    s.q.clear();
                                    s.front([movement(target, 2, target as i32, -1)]);
                                    s.drain();
                                }
                            }
                        }
                    }
                    s.used[..s.n].copy_from_slice(&input.initial_used);
                    for i in 0..s.n {
                        if s.c[i].reserve != 0 {
                            let n = s.c[i]
                                .supply
                                .len()
                                .min(s.r.slots[i][s.c[i].reserve as usize - 1] as usize);
                            s.pile.extend(s.c[i].supply.drain(..n));
                            s.c[i].reserve = 0.max(s.c[i].reserve - 1);
                            if s.c[i].supply.is_empty() {
                                s.c[i].reserve = 0;
                            }
                        }
                    }
                    let eligible: Vec<_> = s.pile.iter().map(|k| k.id).collect();
                    rng.mix(&mut s.pile);
                    s.moved.fill(false);
                    s.phase(1);
                    let mut draw = 0;
                    while draw < s.r.draws && !s.pile.is_empty() {
                        let k = s.pile.remove(0);
                        s.reveal(k);
                        if !s.deferred {
                            draw += 1;
                        }
                    }
                    for k in s.returning.drain(..) {
                        s.c[k.c].supply.push(k);
                    }
                    if s.ipo < 0 {
                        let mut burns: Vec<_> = s
                            .pile
                            .iter()
                            .copied()
                            .filter(|k| eligible.contains(&k.id))
                            .collect();
                        let n = s.r.burn.min(burns.len());
                        for _ in 0..n {
                            let at = (rng.next() * burns.len() as f64) as usize;
                            let k = burns.remove(at);
                            let pos = s.pile.iter().position(|x| x.id == k.id).unwrap();
                            s.pile.remove(pos);
                        }
                    }
                    s.phase(2);
                    if s.r.catchup {
                        s.phase(3);
                    }
                    let crossed = s.c.iter().filter(|x| x.pos >= s.r.cp[leg]).count() as i32;
                    if s.ipo >= 0
                        || crossed >= if leg == 2 { 1 } else { s.r.checkpoint_count }
                        || (s.pile.is_empty() && candidates.is_empty())
                    {
                        break;
                    }
                }
            }
            for x in &s.c {
                wholes[x.id].push(s.whole(x.id));
                paths[x.id].push(if locked {
                    input.locked_prices[x.id]
                } else {
                    s.payout(x.id)
                });
            }
            let exhausted = s.pile.is_empty()
                && !s
                    .c
                    .iter()
                    .any(|x| !x.supply.is_empty() && s.shares(x.id) < s.r.limit);
            if s.ipo >= 0 || exhausted {
                end_leg = leg;
                break;
            }
        }
        for x in &s.c {
            let exit = s.rank(x.id) <= s.r.places
                || (x.founder == 4
                    && !x.down
                    && !x.hiring
                    && s.rank(x.id) == s.n as i32 - 1);
            out.extend([
                elapsed as f64,
                x.pos as f64,
                end_leg as f64,
                wholes[x.id][0],
                s.shares(x.id) as f64,
                if exit { s.payout(x.id) } else { 0. },
            ]);
            for l in 0..3 {
                out.push(
                    paths[x.id]
                        .get(l)
                        .copied()
                        .unwrap_or_else(|| *paths[x.id].last().unwrap()),
                );
            }
            out.extend_from_slice(&spending);
            for p in 0..s.p {
                out.push((x.counts[p] - initial_shares[x.id][p]) as f64);
            }
        }
    }
    out
}

// Small dependency-free Node N-API boundary. All game logic above uses safe Rust.
type Napi = *mut c_void;
type Callback = unsafe extern "C" fn(Napi, Napi) -> Napi;
unsafe extern "C" {
    fn napi_get_cb_info(
        env: Napi,
        info: Napi,
        argc: *mut usize,
        argv: *mut Napi,
        this_arg: *mut Napi,
        data: *mut *mut c_void,
    ) -> i32;
    fn napi_is_typedarray(env: Napi, value: Napi, result: *mut bool) -> i32;
    fn napi_is_arraybuffer(env: Napi, value: Napi, result: *mut bool) -> i32;
    fn napi_get_typedarray_info(
        env: Napi,
        value: Napi,
        kind: *mut i32,
        length: *mut usize,
        data: *mut *mut c_void,
        buffer: *mut Napi,
        offset: *mut usize,
    ) -> i32;
    fn napi_create_arraybuffer(
        env: Napi,
        length: usize,
        data: *mut *mut c_void,
        result: *mut Napi,
    ) -> i32;
    fn napi_create_typedarray(
        env: Napi,
        kind: i32,
        length: usize,
        buffer: Napi,
        offset: usize,
        result: *mut Napi,
    ) -> i32;
    fn napi_create_function(
        env: Napi,
        name: *const c_char,
        length: usize,
        callback: Option<Callback>,
        data: *mut c_void,
        result: *mut Napi,
    ) -> i32;
    fn napi_set_named_property(env: Napi, object: Napi, name: *const c_char, value: Napi) -> i32;
    fn napi_create_int32(env: Napi, value: i32, result: *mut Napi) -> i32;
    fn napi_throw_error(env: Napi, code: *const c_char, message: *const c_char) -> i32;
}
unsafe fn napi_ok(status: i32) -> Result<(), &'static str> {
    if status == 0 {
        Ok(())
    } else {
        Err("Node API call failed")
    }
}
unsafe fn call(env: Napi, info: Napi) -> Result<Napi, &'static str> {
    let mut argc = 1;
    let mut arg = std::ptr::null_mut();
    unsafe {
        napi_ok(napi_get_cb_info(
            env,
            info,
            &mut argc,
            &mut arg,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        ))?;
    }
    if argc != 1 {
        return Err("Expected Float64Array");
    }
    let mut typed = false;
    unsafe {
        napi_ok(napi_is_typedarray(env, arg, &mut typed))?;
    }
    if !typed {
        return Err("Expected Float64Array");
    }
    let (mut kind, mut length, mut data, mut buffer, mut offset) =
        (0, 0, std::ptr::null_mut(), std::ptr::null_mut(), 0);
    unsafe {
        napi_ok(napi_get_typedarray_info(
            env,
            arg,
            &mut kind,
            &mut length,
            &mut data,
            &mut buffer,
            &mut offset,
        ))?;
    }
    if kind != 8 || length > 100000 || length == 0 || data.is_null() {
        return Err("Invalid forecast buffer");
    }
    let mut ordinary_buffer = false;
    unsafe {
        napi_ok(napi_is_arraybuffer(env, buffer, &mut ordinary_buffer))?;
    }
    if !ordinary_buffer {
        return Err("Shared forecast buffers are unsupported");
    }
    let input = unsafe { std::slice::from_raw_parts(data as *const f64, length) };
    let result = simulate(&decode(&mut Reader { data: input, at: 0 })?);
    let (mut output, mut ab, mut ptr) = (
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        std::ptr::null_mut(),
    );
    unsafe {
        napi_ok(napi_create_arraybuffer(
            env,
            result.len() * 8,
            &mut ptr,
            &mut ab,
        ))?;
        if !result.is_empty() {
            std::ptr::copy_nonoverlapping(result.as_ptr(), ptr as *mut f64, result.len());
        }
        napi_ok(napi_create_typedarray(
            env,
            8,
            result.len(),
            ab,
            0,
            &mut output,
        ))?;
    }
    Ok(output)
}
unsafe extern "C" fn run(env: Napi, info: Napi) -> Napi {
    let _scope = ArenaScope::enter();
    let result = catch_unwind(AssertUnwindSafe(|| unsafe { call(env, info) }));
    match result {
        Ok(Ok(value)) => value,
        error => {
            let message = match error {
                Ok(Err(e)) => e,
                _ => "Native forecast failed",
            };
            let message = std::ffi::CString::new(message).unwrap();
            unsafe {
                napi_throw_error(env, std::ptr::null(), message.as_ptr());
            }
            std::ptr::null_mut()
        }
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_register_module_v1(env: Napi, exports: Napi) -> Napi {
    let (mut function, mut protocol) = (std::ptr::null_mut(), std::ptr::null_mut());
    unsafe {
        if napi_create_function(
            env,
            c"run".as_ptr(),
            3,
            Some(run),
            std::ptr::null_mut(),
            &mut function,
        ) != 0
        {
            return std::ptr::null_mut();
        }
        if napi_set_named_property(env, exports, c"run".as_ptr(), function) != 0 {
            return std::ptr::null_mut();
        }
        if napi_create_int32(env, 3, &mut protocol) != 0 {
            return std::ptr::null_mut();
        }
        if napi_set_named_property(env, exports, c"protocol".as_ptr(), protocol) != 0 {
            return std::ptr::null_mut();
        }
    }
    exports
}
#[unsafe(no_mangle)]
pub extern "C" fn node_api_module_get_api_version_v1() -> i32 {
    8
}
