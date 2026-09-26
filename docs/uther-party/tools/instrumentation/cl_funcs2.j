
//------------------------------------------------------------------ experiments
function CL_Put takes player p, integer typ, real x, real y, real f returns unit
    local unit u = CreateUnit(p, typ, x, y, f)
    call SetUnitX(u, x)
    call SetUnitY(u, y)
    set bj_lastCreatedUnit = u
    set u = null
    return bj_lastCreatedUnit
endfunction

function CL_Hold takes unit u returns unit
    call IssueImmediateOrder(u, "holdposition")
    return u
endfunction

function CL_ClearMapExcept takes unit keep returns nothing
    local group g = CreateGroup()
    local unit u
    call GroupEnumUnitsInRect(g, bj_mapInitialPlayableArea, null)
    loop
        set u = FirstOfGroup(g)
        exitwhen u == null
        call GroupRemoveUnit(g, u)
        if u != keep then
            call RemoveUnit(u)
        endif
    endloop
    call DestroyGroup(g)
    set g = null
endfunction

function CL_Hostile takes nothing returns nothing
    local integer i = 0
    loop
        exitwhen i > 7
        call SetPlayerAllianceStateBJ(Player(11), Player(i), bj_ALLIANCE_UNALLIED)
        call SetPlayerAllianceStateBJ(Player(i), Player(11), bj_ALLIANCE_UNALLIED)
        set i = i + 1
    endloop
endfunction

// Artillery: flight time vs distance (catapult attacking a held peon), then splash rings around a ground target.
function CL_ExpArt takes nothing returns nothing
    local real cx = GetRectCenterX(cl_lab) - 900
    local real cy = GetRectCenterY(cl_lab)
    local unit c = CL_Put(Player(11), 'ncat', cx, cy, 0)
    local unit v
    local integer k = 0
    local integer r
    local real d
    local real a
    call CL_Hostile()
    call CL_Msg("exp art: flight time")
    call UnitAddAbility(c, 'Avul')
    call TriggerSleepAction(1.0)
    loop
        exitwhen k > 5
        set d = 300 + 300 * k
        set v = CL_Hold(CL_Put(Player(0), 'opeo', cx + d, cy, 180))
        call CL_Add("X," + CL_T() + ",art,flight," + R2SW(d, 1, 0) + "," + CL_Id(c) + "," + CL_Id(v))
        call IssueTargetOrder(c, "attack", v)
        call TriggerSleepAction(8.0)
        call IssueImmediateOrder(c, "stop")
        call RemoveUnit(v)
        set k = k + 1
    endloop
    call CL_Msg("exp art: splash rings")
    set k = 0
    loop
        exitwhen k > 2
        set r = 0
        loop
            exitwhen r > 15
            set d = 12.5 * r
            set a = 33.0 * r
            call CL_Hold(CL_Put(Player(0), 'opeo', cx + 900 + d * Cos(a * bj_DEGTORAD), cy + d * Sin(a * bj_DEGTORAD), 180))
            set r = r + 1
        endloop
        call TriggerSleepAction(0.5)
        call CL_Add("X," + CL_T() + ",art,ring," + R2SW(cx + 900, 1, 1) + "," + R2SW(cy, 1, 1) + "," + CL_Id(c))
        call IssuePointOrder(c, "attackground", cx + 900, cy)
        call TriggerSleepAction(4.6)
        call IssueImmediateOrder(c, "stop")
        call TriggerSleepAction(0.5)
        call CL_ClearMapExcept(c)
        set k = k + 1
    endloop
    call RemoveUnit(c)
    call CL_Msg("exp art done")
    set c = null
    set v = null
endfunction

// Missiles: homing troll (weapon "missile") vs the Way of the Bow archer ("missile (splash)" with no radius),
// both shooting a knight that stands still, then runs back and forth across the line of fire.
function CL_ExpMiss takes nothing returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit s
    local unit v
    local integer k = 0
    local integer j
    local integer typ = 'nftr'
    call CL_Hostile()
    loop
        exitwhen k > 1
        if k == 1 then
            set typ = 'earc'
        endif
        set s = CL_Put(Player(11), typ, cx - 400, cy, 0)
        call UnitAddAbility(s, 'Avul')
        set v = CL_Put(Player(0), 'hkni', cx, cy, 90)
        call CL_Add("X," + CL_T() + ",miss,still," + I2S(typ) + "," + CL_Id(s) + "," + CL_Id(v))
        call IssueTargetOrder(s, "attack", v)
        call TriggerSleepAction(5.0)
        call CL_Add("X," + CL_T() + ",miss,run," + I2S(typ) + "," + CL_Id(s) + "," + CL_Id(v))
        set j = 0
        loop
            exitwhen j > 5
            if ModuloInteger(j, 2) == 0 then
                call IssuePointOrder(v, "move", cx, cy + 300)
            else
                call IssuePointOrder(v, "move", cx, cy - 300)
            endif
            call TriggerSleepAction(1.8)
            set j = j + 1
        endloop
        call RemoveUnit(s)
        call RemoveUnit(v)
        set k = k + 1
    endloop
    call CL_Msg("exp miss done")
    set s = null
    set v = null
endfunction

// Collision: head-on paladins (enemies, then same owner), walking through an idle paladin (enemy, then own),
// eight peons of different players swapping across a circle.
function CL_ExpColl takes nothing returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit a = CL_Put(Player(0), 'Hart', cx - 400, cy, 0)
    local unit b = CL_Put(Player(1), 'Hart', cx + 400, cy, 180)
    local integer k = 0
    local integer i
    loop
        exitwhen k > 3
        if k == 1 or k == 3 then
            call SetUnitOwner(b, Player(0), true)
        else
            call SetUnitOwner(b, Player(1), true)
        endif
        call IssueImmediateOrder(a, "stop")
        call IssueImmediateOrder(b, "stop")
        call SetUnitPosition(a, cx - 400, cy)
        if k < 2 then
            call SetUnitPosition(b, cx + 400, cy + 10)
        else
            call SetUnitPosition(b, cx, cy + 10)
        endif
        call TriggerSleepAction(0.5)
        call CL_Add("X," + CL_T() + ",coll," + I2S(k) + "," + CL_Id(a) + "," + CL_Id(b))
        call IssuePointOrder(a, "move", cx + 400, cy)
        if k < 2 then
            call IssuePointOrder(b, "move", cx - 400, cy)
        endif
        call TriggerSleepAction(5.0)
        set k = k + 1
    endloop
    call RemoveUnit(a)
    call RemoveUnit(b)
    call CL_Add("X," + CL_T() + ",coll,swap8")
    set i = 0
    loop
        exitwhen i > 7
        set a = CL_Put(Player(i), 'opeo', cx + 300 * Cos(i * 45 * bj_DEGTORAD), cy + 300 * Sin(i * 45 * bj_DEGTORAD), i * 45 + 180)
        call IssuePointOrder(a, "move", cx - 300 * Cos(i * 45 * bj_DEGTORAD), cy - 300 * Sin(i * 45 * bj_DEGTORAD))
        set i = i + 1
    endloop
    call TriggerSleepAction(8.0)
    call CL_ClearMap()
    call CL_Msg("exp coll done")
    set a = null
    set b = null
endfunction

// Melee chase: abomination (270, range 128) attacks a fleeing peon, then a paladin that runs and turns back.
function CL_ExpChase takes nothing returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit a = CL_Put(Player(11), 'uabo', cx - 800, cy, 0)
    local unit v = CL_Put(Player(0), 'opeo', cx - 400, cy, 0)
    call CL_Hostile()
    call CL_Add("X," + CL_T() + ",chase,peon," + CL_Id(a) + "," + CL_Id(v))
    call IssuePointOrder(v, "move", cx + 900, cy)
    call IssueTargetOrder(a, "attack", v)
    call TriggerSleepAction(8.0)
    call RemoveUnit(v)
    call IssueImmediateOrder(a, "stop")
    call SetUnitPosition(a, cx - 800, cy)
    set v = CL_Put(Player(0), 'Hart', cx - 400, cy, 0)
    call SetUnitInvulnerable(v, true)
    call CL_Add("X," + CL_T() + ",chase,paladin," + CL_Id(a) + "," + CL_Id(v))
    call IssuePointOrder(v, "move", cx + 900, cy + 300)
    call IssueTargetOrder(a, "attack", v)
    call TriggerSleepAction(6.0)
    call IssuePointOrder(v, "move", cx - 900, cy - 300)
    call TriggerSleepAction(6.0)
    call RemoveUnit(v)
    call RemoveUnit(a)
    call CL_Msg("exp chase done")
    set a = null
    set v = null
endfunction

// Dodge test for Way of the Bow: an archer shoots a mortal paladin (650 HP) that runs across the line of fire and
// reverses a fixed delay after each attack starts (release = +0.72 s). Delays 0.40 (before release) to 1.00 s.
function CL_DodgeResume takes nothing returns nothing
    call IssuePointOrder(cl_dodge_v, "move", GetUnitX(cl_dodge_v), GetRectCenterY(cl_lab) + 500 * cl_dodge_dir)
    call CL_Add("X," + CL_T() + ",dodge,resume," + I2S(cl_dodge_dir))
endfunction

// mode 0 reverses at once; mode 1 stops, then sets off the other way 0.5 s later
function CL_DodgeFlip takes nothing returns nothing
    set cl_dodge_dir = -cl_dodge_dir
    if cl_dodge_mode == 1 then
        call IssueImmediateOrder(cl_dodge_v, "stop")
        call CL_Add("X," + CL_T() + ",dodge,stop," + I2S(cl_dodge_dir))
        call TimerStart(cl_dodge_timer2, 0.5, false, function CL_DodgeResume)
        return
    endif
    call IssuePointOrder(cl_dodge_v, "move", GetUnitX(cl_dodge_v), GetRectCenterY(cl_lab) + 500 * cl_dodge_dir)
    call CL_Add("X," + CL_T() + ",dodge,flip," + I2S(cl_dodge_dir))
endfunction

function CL_DodgeOnAttack takes nothing returns nothing
    if GetTriggerUnit() == cl_dodge_v and cl_dodge_delay > 0 then
        call TimerStart(cl_dodge_timer, cl_dodge_delay, false, function CL_DodgeFlip)
    endif
endfunction

function CL_ExpDodge takes real range returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit s
    local integer k = 0
    local trigger t = CreateTrigger()
    call CL_Hostile()
    // EVENT_PLAYER_UNIT_ATTACKED fires for the owner of the unit being attacked
    call TriggerRegisterPlayerUnitEvent(t, Player(0), EVENT_PLAYER_UNIT_ATTACKED, null)
    call TriggerAddAction(t, function CL_DodgeOnAttack)
    set cl_dodge_timer = CreateTimer()
    loop
        exitwhen k > 6
        set cl_dodge_delay = 0.4 + 0.1 * k
        set s = CL_Put(Player(11), 'earc', cx - range, cy, 0)
        call UnitAddAbility(s, 'Avul')
        set cl_dodge_v = CL_Put(Player(0), 'Hart', cx, cy - 300, 90)
        call UnitRemoveAbility(cl_dodge_v, 'Avul')
        set cl_dodge_dir = 1
        call IssuePointOrder(cl_dodge_v, "move", cx, cy + 500)
        call CL_Add("X," + CL_T() + ",dodge,start," + R2SW(cl_dodge_delay, 1, 2) + "," + R2SW(range, 1, 0) + "," + CL_Id(s) + "," + CL_Id(cl_dodge_v))
        call IssueTargetOrder(s, "attack", cl_dodge_v)
        call TriggerSleepAction(8.0)
        call CL_Add("X," + CL_T() + ",dodge,end," + R2SW(GetWidgetLife(cl_dodge_v), 1, 1))
        call RemoveUnit(s)
        call RemoveUnit(cl_dodge_v)
        set k = k + 1
    endloop
    set cl_dodge_delay = 0
    call DestroyTrigger(t)
    call CL_Msg("exp dodge done")
    set s = null
    set t = null
endfunction

// Dodge follow-up: finer delays around the 0.72 s release, a hero (Hart) vs a plain unit (hkni), and
// reverse (mode 0) vs stop-then-reverse (mode 1). Archer 400 u away; 6 s (4 attacks) per delay.
function CL_ExpDodge2 takes integer vtyp, integer mode returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit s
    local integer k = 0
    local trigger t = CreateTrigger()
    call CL_Hostile()
    call TriggerRegisterPlayerUnitEvent(t, Player(0), EVENT_PLAYER_UNIT_ATTACKED, null)
    call TriggerAddAction(t, function CL_DodgeOnAttack)
    set cl_dodge_timer = CreateTimer()
    set cl_dodge_timer2 = CreateTimer()
    set cl_dodge_mode = mode
    loop
        exitwhen k > 5
        set cl_dodge_delay = 0.5 + 0.05 * k
        if k == 5 then
            set cl_dodge_delay = 0.9
        endif
        set s = CL_Put(Player(11), 'earc', cx - 400, cy, 0)
        call UnitAddAbility(s, 'Avul')
        set cl_dodge_v = CL_Put(Player(0), vtyp, cx, cy - 300, 90)
        call UnitRemoveAbility(cl_dodge_v, 'Avul')
        set cl_dodge_dir = 1
        call IssuePointOrder(cl_dodge_v, "move", cx, cy + 500)
        call CL_Add("X," + CL_T() + ",dodge,start," + R2SW(cl_dodge_delay, 1, 2) + ",400," + CL_Id(s) + "," + CL_Id(cl_dodge_v) + "," + I2S(vtyp) + "," + I2S(mode))
        call IssueTargetOrder(s, "attack", cl_dodge_v)
        call TriggerSleepAction(6.0)
        call PauseTimer(cl_dodge_timer)
        call PauseTimer(cl_dodge_timer2)
        call CL_Add("X," + CL_T() + ",dodge,end," + R2SW(GetWidgetLife(cl_dodge_v), 1, 1))
        call RemoveUnit(s)
        call RemoveUnit(cl_dodge_v)
        set k = k + 1
    endloop
    set cl_dodge_delay = 0
    set cl_dodge_mode = 0
    call DestroyTrigger(t)
    call CL_Msg("exp dodge2 done")
    set s = null
    set t = null
endfunction

// Orphaned missiles: kill the shooter just after it releases. Does the missile still deal damage?
function CL_OrphanKill takes nothing returns nothing
    call CL_Add("X," + CL_T() + ",orphan,kill," + CL_Id(cl_orphan_s))
    call KillUnit(cl_orphan_s)
endfunction

function CL_OrphanOnAttack takes nothing returns nothing
    if GetTriggerUnit() == cl_dodge_v and cl_orphan_delay > 0 and GetAttacker() != cl_orphan_s then
        set cl_orphan_s = GetAttacker()
        call TimerStart(cl_dodge_timer, cl_orphan_delay, false, function CL_OrphanKill)
    endif
endfunction

function CL_ExpOrphan takes integer typ, real delay returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit s
    local integer k = 0
    local trigger t = CreateTrigger()
    call CL_Hostile()
    call TriggerRegisterPlayerUnitEvent(t, Player(0), EVENT_PLAYER_UNIT_ATTACKED, null)
    call TriggerAddAction(t, function CL_OrphanOnAttack)
    set cl_dodge_timer = CreateTimer()
    loop
        exitwhen k > 2
        set s = CL_Put(Player(11), typ, cx - 400, cy, 0)
        set cl_dodge_v = CL_Hold(CL_Put(Player(0), 'Hart', cx, cy, 180))
        call UnitRemoveAbility(cl_dodge_v, 'Avul')
        set cl_orphan_delay = delay
        call CL_Add("X," + CL_T() + ",orphan,start," + I2S(typ) + "," + R2SW(delay, 1, 2) + "," + CL_Id(s) + "," + CL_Id(cl_dodge_v))
        call IssueTargetOrder(s, "attack", cl_dodge_v)
        call TriggerSleepAction(3.0)
        call CL_Add("X," + CL_T() + ",orphan,end," + R2SW(GetWidgetLife(cl_dodge_v), 1, 1))
        call RemoveUnit(s)
        call RemoveUnit(cl_dodge_v)
        set k = k + 1
    endloop
    set cl_orphan_delay = 0
    set cl_orphan_s = null
    call DestroyTrigger(t)
    call CL_Msg("exp orphan done")
    set s = null
    set t = null
endfunction

// Melee chase 2: abomination vs a mortal paladin at equal speed (270): straight flight, then a stop, then circling.
function CL_ExpChase2 takes nothing returns nothing
    local real cx = GetRectCenterX(cl_lab)
    local real cy = GetRectCenterY(cl_lab)
    local unit a = CL_Put(Player(11), 'uabo', cx - 700, cy, 0)
    local unit v = CL_Put(Player(0), 'Hart', cx - 400, cy, 0)
    local integer k = 0
    call CL_Hostile()
    call UnitRemoveAbility(v, 'Avul')
    call UnitAddAbility(a, 'Avul')
    call CL_Add("X," + CL_T() + ",chase2,flee," + CL_Id(a) + "," + CL_Id(v))
    call IssuePointOrder(v, "move", cx + 900, cy)
    call IssueTargetOrder(a, "attack", v)
    call TriggerSleepAction(4.5)
    call CL_Add("X," + CL_T() + ",chase2,stop," + CL_Id(a) + "," + CL_Id(v))
    call IssueImmediateOrder(v, "stop")
    call TriggerSleepAction(3.0)
    call CL_Add("X," + CL_T() + ",chase2,circle," + CL_Id(a) + "," + CL_Id(v))
    loop
        exitwhen k > 15
        call IssuePointOrder(v, "move", cx + 350 * Cos(k * 0.785), cy + 350 * Sin(k * 0.785))
        call TriggerSleepAction(0.6)
        set k = k + 1
    endloop
    call CL_Add("X," + CL_T() + ",chase2,end," + R2SW(GetWidgetLife(v), 1, 1))
    call RemoveUnit(v)
    call RemoveUnit(a)
    call CL_Msg("exp chase2 done")
    set a = null
    set v = null
endfunction

function CL_ExpRun takes string which returns nothing
    call CL_SetRate(0.03)
    if which == "art" or which == "all" then
        call CL_ExpArt()
    endif
    if which == "miss" or which == "all" then
        call CL_ExpMiss()
    endif
    if which == "coll" or which == "all" then
        call CL_ExpColl()
    endif
    if which == "chase" or which == "all" then
        call CL_ExpChase()
    endif
    if which == "dodge" or which == "two" then
        call CL_ExpDodge(800)
        call CL_ExpDodge(400)
    endif
    if which == "dodge2" then
        call CL_ExpDodge2('Hart', 0)
        call CL_ExpDodge2('hkni', 0)
        call CL_ExpDodge2('Hart', 1)
        call CL_ExpDodge2('hkni', 1)
    endif
    if which == "chase2" or which == "two" then
        call CL_ExpChase2()
    endif
    if which == "orphan" or which == "two" then
        call CL_ExpOrphan('earc', 0.80)
        call CL_ExpOrphan('nhea', 0.80)
        call CL_ExpOrphan('ohun', 0.40)
        call CL_ExpOrphan('earc', 0.0)
    endif
    call CL_SetRate(0.1)
    call CL_Dump()
endfunction

//------------------------------------------------------------------ spectator camera (for watching from the brown seat)
function CL_FollowEnum takes nothing returns nothing
    local unit u = GetEnumUnit()
    if GetWidgetLife(u) > 0.405 then
        set cl_fx = cl_fx + GetUnitX(u)
        set cl_fy = cl_fy + GetUnitY(u)
        set cl_fn = cl_fn + 1
    endif
    set u = null
endfunction

function CL_FollowTick takes nothing returns nothing
    if not cl_follow then
        return
    endif
    set cl_fx = 0
    set cl_fy = 0
    set cl_fn = 0
    call ForGroup(udg_UnitGroup_KeyUnits, function CL_FollowEnum)
    if cl_fn > 0 then
        call SetCameraBoundsToRect(bj_mapInitialPlayableArea)
        call PanCameraToTimed(cl_fx / cl_fn, cl_fy / cl_fn, 0.9)
    endif
endfunction

// Wandering bot for maps without computer-player logic. Every 1.5 s each computer contestant either walks to a
// random point within cl_botr of the key units' centre (1 in 2), sprays one common ability order (1 in 3; orders
// the unit does not have are refused without side effects), or keeps doing what it was doing.
function CL_BotOrders takes nothing returns nothing
    set cl_noi = 0
    set cl_oi[0] = "stomp"
    set cl_oi[1] = "thunderclap"
    set cl_oi[2] = "immolation"
    set cl_oi[3] = "divineshield"
    set cl_oi[4] = "roar"
    set cl_oi[5] = "berserk"
    set cl_oi[6] = "windwalk"
    set cl_oi[7] = "defend"
    set cl_oi[8] = "taunt"
    set cl_oi[9] = "howlofterror"
    set cl_oi[10] = "avatar"
    set cl_oi[11] = "creepthunderclap"
    set cl_oi[12] = "manashieldon"
    set cl_oi[13] = "battleroar"
    set cl_noi = 14
    set cl_op[0] = "blink"
    set cl_op[1] = "silence"
    set cl_op[2] = "shockwave"
    set cl_op[3] = "carrionswarm"
    set cl_op[4] = "flamestrike"
    set cl_op[5] = "blizzard"
    set cl_op[6] = "clusterrockets"
    set cl_op[7] = "breathoffire"
    set cl_op[8] = "attackground"
    set cl_op[9] = "cloudoffog"
    set cl_op[10] = "rainoffire"
    set cl_op[11] = "earthquake"
    set cl_nop = 12
    set cl_ot[0] = "chainlightning"
    set cl_ot[1] = "manaburn"
    set cl_ot[2] = "polymorph"
    set cl_ot[3] = "purge"
    set cl_ot[4] = "frostnova"
    set cl_ot[5] = "thunderbolt"
    set cl_ot[6] = "hex"
    set cl_ot[7] = "entanglingroots"
    set cl_ot[8] = "slow"
    set cl_ot[9] = "possession"
    set cl_ot[10] = "charm"
    set cl_ot[11] = "attack"
    set cl_ot[12] = "deathcoil"
    set cl_ot[13] = "forkedlightning"
    set cl_ot[14] = "cripple"
    set cl_ot[15] = "bloodlust"
    set cl_ot[16] = "drunkenhaze"
    set cl_not = 17
endfunction

function CL_BotEnum takes nothing returns nothing
    local unit u = GetEnumUnit()
    local player p = GetOwningPlayer(u)
    local real a = GetRandomReal(0, 6.2832)
    local real r = GetRandomReal(0, cl_botr)
    local integer k = GetRandomInt(1, 6)
    local integer c
    local unit v
    local boolean ok = false
    if GetPlayerController(p) == MAP_CONTROL_COMPUTER and GetPlayerId(p) < 8 and GetWidgetLife(u) > 0.405 then
        if k <= 3 then
            call IssuePointOrder(u, "move", cl_bx + r * Cos(a), cl_by + r * Sin(a))
        elseif k <= 5 then
            set c = GetRandomInt(1, 3)
            set v = GroupPickRandomUnit(udg_UnitGroup_KeyUnits)
            if c == 1 then
                set k = GetRandomInt(0, cl_noi - 1)
                set ok = IssueImmediateOrder(u, cl_oi[k])
                if ok then
                    call CL_Add("BO," + CL_T() + "," + CL_Id(u) + "," + cl_oi[k])
                endif
            elseif c == 2 and v != null then
                set k = GetRandomInt(0, cl_nop - 1)
                set ok = IssuePointOrder(u, cl_op[k], GetUnitX(v) + GetRandomReal(-150, 150), GetUnitY(v) + GetRandomReal(-150, 150))
                if ok then
                    call CL_Add("BO," + CL_T() + "," + CL_Id(u) + "," + cl_op[k])
                endif
            elseif v != null and v != u then
                set k = GetRandomInt(0, cl_not - 1)
                set ok = IssueTargetOrder(u, cl_ot[k], v)
                if ok then
                    call CL_Add("BO," + CL_T() + "," + CL_Id(u) + "," + cl_ot[k])
                endif
            endif
        endif
    endif
    set u = null
    set v = null
    set p = null
endfunction

function CL_BotTick takes nothing returns nothing
    if not cl_bot then
        return
    endif
    set cl_fx = 0
    set cl_fy = 0
    set cl_fn = 0
    call ForGroup(udg_UnitGroup_KeyUnits, function CL_FollowEnum)
    if cl_fn > 0 then
        set cl_bx = cl_fx / cl_fn
        set cl_by = cl_fy / cl_fn
        call ForGroup(udg_UnitGroup_KeyUnits, function CL_BotEnum)
    endif
endfunction

function CL_Spectate takes nothing returns nothing
    call SetCameraBoundsToRect(bj_mapInitialPlayableArea)
    call FogMaskEnableOff()
    call FogEnableOff()
endfunction

//------------------------------------------------------------------ tour: play games A..B in order, one log file each, optional time cap
function CL_Abort takes string why returns nothing
    call CL_Add("C," + CL_T() + "," + why + "," + I2S(cl_gnum))
    call PauseTimer(udg_Timer_TimeLeft)
    call DestroyTimerDialogBJ(GetLastCreatedTimerDialogBJ())
    call EnableTrigger(gg_trg_Win)
    call EnableTrigger(gg_trg_Draw)
    call EnableTrigger(gg_trg_Finish)
    call TriggerExecute(gg_trg_Next_Event)
endfunction

function CL_CapExpire takes nothing returns nothing
    // skip when the game is already ending (Win/Draw/Finish disable themselves during the 4 s fade)
    if IsTriggerEnabled(gg_trg_Win) and IsTriggerEnabled(gg_trg_Draw) and IsTriggerEnabled(gg_trg_Finish) then
        call CL_Abort("cap")
    else
        call CL_Add("C," + CL_T() + ",cap-skipped-ending," + I2S(cl_gnum))
    endif
endfunction

// Called by the patched Filter right before a minigame's Initialization trigger runs.
function CL_GameStart takes integer n, string how returns nothing
    local integer i = 1
    call CL_Dump()
    set cl_gseq = cl_gseq + 1
    set cl_gnum = n
    call CL_Add("G," + CL_T() + "," + how + "," + I2S(n) + "," + I2S(udg_Integer_GamesPlayed) + "," + I2S(cl_gseq) + "," + I2S(udg_Integer_Ante))
    loop
        exitwhen i > 8
        call CL_Add("SC0," + I2S(i) + "," + I2S(udg_Integers_Scores[i]) + "," + I2S(GetHandleId(GetPlayerSlotState(Player(i - 1)))))
        set i = i + 1
    endloop
    if cl_cap > 0 then
        call TimerStart(cl_captimer, cl_cap, false, function CL_CapExpire)
    endif
endfunction

function CL_Tour takes string args returns nothing
    local integer sp = 0
    loop
        exitwhen sp >= StringLength(args) or SubString(args, sp, sp + 1) == " "
        set sp = sp + 1
    endloop
    set cl_tour = S2I(SubString(args, 0, sp))
    set cl_tour_end = S2I(SubString(args, sp + 1, StringLength(args)))
    if cl_tour_end < cl_tour then
        set cl_tour_end = cl_tour
    endif
    set udg_Integer_GameLength = 999
    call CL_Msg("tour " + I2S(cl_tour) + " to " + I2S(cl_tour_end) + ", cap " + R2S(cl_cap) + " s")
    call CL_Abort("tour")
endfunction

//------------------------------------------------------------------ chat + init
function CL_Arg takes string c, integer from returns string
    return SubString(c, from, StringLength(c))
endfunction

function CL_OnChat takes nothing returns nothing
    local string s = GetEventPlayerChatString()
    local string c = SubString(s, 4, StringLength(s))
    call CL_Add("M," + CL_T() + ",chat," + I2S(GetPlayerId(GetTriggerPlayer())) + "," + s)
    if SubString(s, 0, 4) != "-cl " then
        return
    endif
    if c == "dump" then
        call CL_Dump()
    elseif c == "lab" then
        call CL_Lab()
    elseif c == "free" then
        call CL_Free()
    elseif c == "log on" then
        set cl_on = true
        call CL_Msg("log on")
    elseif c == "log off" then
        set cl_on = false
        call CL_Msg("log off")
    elseif SubString(c, 0, 3) == "go " then
        call CL_Go(S2I(CL_Arg(c, 3)))
    elseif SubString(c, 0, 5) == "next " then
        set cl_force = S2I(CL_Arg(c, 5))
        call CL_Msg("next game forced: " + I2S(cl_force))
    elseif SubString(c, 0, 4) == "len " then
        set udg_Integer_GameLength = S2I(CL_Arg(c, 4))
        call CL_Msg("match length " + I2S(udg_Integer_GameLength))
    elseif SubString(c, 0, 5) == "rate " then
        call CL_SetRate(S2R(CL_Arg(c, 5)))
        call CL_Msg("rate " + R2S(cl_rate))
    elseif SubString(c, 0, 5) == "tour " then
        call CL_Tour(CL_Arg(c, 5))
    elseif SubString(c, 0, 4) == "cap " then
        set cl_cap = S2R(CL_Arg(c, 4))
        call CL_Msg("per-game cap " + R2S(cl_cap) + " s (0 = off)")
    elseif c == "abort" then
        call CL_Abort("chat")
    elseif c == "bot" then
        set cl_bot = not cl_bot
        if cl_bot then
            call CL_Msg("wandering bot on for computer contestants (radius " + R2S(cl_botr) + ")")
        else
            call CL_Msg("wandering bot off")
        endif
    elseif SubString(c, 0, 5) == "botr " then
        set cl_botr = S2R(CL_Arg(c, 5))
        call CL_Msg("bot radius " + R2S(cl_botr))
    elseif c == "follow" then
        set cl_follow = not cl_follow
        call CL_Spectate()
        if cl_follow then
            call CL_Msg("camera follows the contestants")
        else
            call CL_Msg("camera free")
        endif
    elseif c == "cam" then
        call CL_Spectate()
        call CL_Msg("camera bounds = whole map, fog off")
    elseif SubString(c, 0, 4) == "exp " then
        call CL_ExpRun(CL_Arg(c, 4))
    else
        call CL_Msg("unknown: " + c)
    endif
endfunction

function CL_Init takes nothing returns nothing
    local trigger t
    local integer p = 0
    set cl_ht = InitHashtable()
    set cl_grp = CreateGroup()
    set cl_lab = gg_rct_Tower_Defense
    set cl_clock = CreateTimer()
    call TimerStart(cl_clock, 1000.0, true, function CL_ClockWrap)
    set cl_tick = CreateTimer()
    call TimerStart(cl_tick, cl_rate, true, function CL_Sample)
    set cl_captimer = CreateTimer()
    call CL_BotOrders()
    set cl_bottimer = CreateTimer()
    call TimerStart(cl_bottimer, 1.5, true, function CL_BotTick)
    set cl_ftimer = CreateTimer()
    call TimerStart(cl_ftimer, 1.0, true, function CL_FollowTick)
    set cl_dmg = CreateTrigger()
    call TriggerAddAction(cl_dmg, function CL_OnDamage)
    set t = CreateTrigger()
    loop
        exitwhen p > 15
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_ISSUED_POINT_ORDER, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_ISSUED_TARGET_ORDER, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_ISSUED_ORDER, null)
        set p = p + 1
    endloop
    call TriggerAddAction(t, function CL_OnOrder)
    set t = CreateTrigger()
    set p = 0
    loop
        exitwhen p > 15
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_SPELL_CHANNEL, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_SPELL_CAST, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_SPELL_EFFECT, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_SPELL_FINISH, null)
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_SPELL_ENDCAST, null)
        set p = p + 1
    endloop
    call TriggerAddAction(t, function CL_OnSpell)
    set t = CreateTrigger()
    set p = 0
    loop
        exitwhen p > 15
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_DEATH, null)
        set p = p + 1
    endloop
    call TriggerAddAction(t, function CL_OnDeath)
    set t = CreateTrigger()
    set p = 0
    loop
        exitwhen p > 15
        call TriggerRegisterPlayerUnitEvent(t, Player(p), EVENT_PLAYER_UNIT_ATTACKED, null)
        set p = p + 1
    endloop
    call TriggerAddAction(t, function CL_OnAttacked)
    set t = CreateTrigger()
    set p = 0
    loop
        exitwhen p > 11
        call TriggerRegisterPlayerChatEvent(t, Player(p), "-cl ", false)
        set p = p + 1
    endloop
    call TriggerAddAction(t, function CL_OnChat)
    set p = 0
    loop
        exitwhen p > 11
        call CL_Add("P," + I2S(p) + "," + I2S(GetPlayerId(Player(p))) + "," + I2S(GetHandleId(GetPlayerController(Player(p)))) + "," + I2S(GetHandleId(GetPlayerSlotState(Player(p)))) + "," + GetPlayerName(Player(p)))
        set p = p + 1
    endloop
    call CL_Add("B," + CL_T() + ",claude-instrumented Uther Party 4.0")
    set t = null
endfunction
