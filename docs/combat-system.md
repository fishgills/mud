Combat Math (Authoritative)
Variables
S = Strength
A = Agility
H = Health
L = Level

Attacker stats:

(Sa, Aa, Ha, La)

Defender stats:

(Sd, Ad, Hd, Ld)

Helper:

clamp(x, min, max) = min(max(x, min), max)

Effective Stats (Diminishing Returns)
S' = sqrt(S)
A' = sqrt(A)
H' = sqrt(H)
L' = sqrt(L)

Combat Ratings
Attack Rating (attacker)
AR = 10*S'a + 4*A'a + 6\*L'a

Defense Rating (defender)
DR = 10*A'd + 2*H'd + 6\*L'd

Hit Chance (Never Zero)
x = (AR - DR) / 15
p_raw = 1 / (1 + e^(-x))
p_hit = clamp(p_raw, 0.10, 0.90)

Guarantees:

minimum 10% hit chance

maximum 90% hit chance

Base Damage (On Hit)
D_base = 4 + 2*S'a + 0.5*L'a

Damage Mitigation (Defender Toughness)
T = 6*H'd + 3*A'd
mitigation = T / (T + 100)
damage = max(1, D_base \* (1 - mitigation))

Damage can never be reduced to zero.

Optional Critical Hits
p_crit = clamp(
0.05 + (A'a - A'd) / 100,
0.05,
0.25
)

crit_multiplier = 1.5

On hit:

if rand() < p_crit:
damage = damage \* crit_multiplier

HP Scaling (Infinite)
HP_max = 30 + 8*H' + 6*L'

Initiative (Agility-Ordered)
initiative = 1000*A' + 10*L' + random(0,50)

Sort descending once at combat start.

One Attack Resolution
if rand() < p_hit:
target.hp -= round(damage)
else:
miss
