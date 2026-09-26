//===========================================================================
// Claude instrumentation for Uther Party 4.0: unit logger + event log + debug
// controls + engine experiments. Output: Preload files Logs\claude_N.txt.
// Chat (red only):
//   -cl lab          end the intro, clear the map, camera to the lab (Tower Defense arena)
//   -cl go N         start minigame N now (1-52); -cl next N  make N the next rolled game
//   -cl free         jump to Free Play with red as champion (999 free games)
//   -cl len N        set match length (games)      -cl dump   write the log now
//   -cl log on|off   -cl rate X  sampler period (s)
//   -cl exp art | miss | coll | chase    engine experiments in the lab
//===========================================================================
function CL_T takes nothing returns string
    return R2SW(cl_base + TimerGetElapsed(cl_clock), 1, 3)
endfunction

function CL_ClockWrap takes nothing returns nothing
    set cl_base = cl_base + 1000.0
endfunction

function CL_Flush takes nothing returns nothing
    if cl_line != "" then
        set cl_buf[cl_n] = cl_line
        set cl_n = cl_n + 1
        set cl_line = ""
    endif
endfunction

function CL_Dump takes nothing returns nothing
    local integer i = 0
    call CL_Flush()
    call PreloadGenClear()
    call PreloadGenStart()
    loop
        exitwhen i >= cl_n
        call Preload(cl_buf[i])
        set i = i + 1
    endloop
    call PreloadGenEnd("Logs\\claude_up_" + I2S(cl_file) + ".txt")
    call DisplayTimedTextToPlayer(Player(0), 0, 0, 5, "CL: wrote Logs\\claude_up_" + I2S(cl_file) + ".txt, " + I2S(cl_n) + " lines")
    set cl_file = cl_file + 1
    set cl_n = 0
endfunction

// Preload keeps at most 259 characters of a string, so flush before a line would pass 250.
function CL_Add takes string s returns nothing
    if StringLength(cl_line) + StringLength(s) > 249 then
        call CL_Flush()
        if cl_n >= 6000 then
            call CL_Dump()
        endif
    endif
    set cl_line = cl_line + SubString(s, 0, 249) + ";"
endfunction

function CL_Msg takes string s returns nothing
    call DisplayTimedTextToPlayer(Player(0), 0, 0, 6, "CL: " + s)
    call CL_Add("M," + CL_T() + "," + s)
endfunction

function CL_Id takes unit u returns string
    if u == null then
        return "0"
    endif
    return I2S(GetHandleId(u))
endfunction

// New unit (or handle reused): full description, once.
function CL_New takes unit u, integer id returns nothing
    call CL_Add("N," + I2S(id) + "," + CL_T() + "," + I2S(GetUnitTypeId(u)) + "," + I2S(GetPlayerId(GetOwningPlayer(u))) + "," + GetUnitName(u) + "," + R2SW(GetUnitX(u), 1, 1) + "," + R2SW(GetUnitY(u), 1, 1) + "," + R2SW(GetUnitState(u, UNIT_STATE_MAX_LIFE), 1, 0) + "," + R2SW(GetUnitMoveSpeed(u), 1, 1) + "," + R2SW(GetUnitTurnSpeed(u), 1, 3) + "," + R2SW(GetUnitPropWindow(u) * bj_RADTODEG, 1, 1) + "," + R2SW(GetUnitAcquireRange(u), 1, 0) + "," + R2SW(GetUnitFlyHeight(u), 1, 0))
    call TriggerRegisterUnitEvent(cl_dmg, u, EVENT_UNIT_DAMAGED)
endfunction

function CL_SampleEnum takes nothing returns nothing
    local unit u = GetEnumUnit()
    local integer id = GetHandleId(u)
    local integer xi = R2I(GetUnitX(u) * 2)
    local integer yi = R2I(GetUnitY(u) * 2)
    local integer fi = R2I(GetUnitFacing(u))
    local integer hi = R2I(GetWidgetLife(u))
    local integer oi = GetUnitCurrentOrder(u)
    local integer ms = R2I(GetUnitMoveSpeed(u))
    local integer last = LoadInteger(cl_ht, id, 0)
    if last == 0 or last < cl_tickn - 1 or LoadInteger(cl_ht, id, 7) != GetUnitTypeId(u) then
        call CL_New(u, id)
        call SaveInteger(cl_ht, id, 7, GetUnitTypeId(u))
        call SaveInteger(cl_ht, id, 1, xi + 1)
    endif
    call SaveInteger(cl_ht, id, 0, cl_tickn)
    if xi != LoadInteger(cl_ht, id, 1) or yi != LoadInteger(cl_ht, id, 2) or fi != LoadInteger(cl_ht, id, 3) or oi != LoadInteger(cl_ht, id, 5) or ms != LoadInteger(cl_ht, id, 6) then
        call SaveInteger(cl_ht, id, 1, xi)
        call SaveInteger(cl_ht, id, 2, yi)
        call SaveInteger(cl_ht, id, 3, fi)
        call SaveInteger(cl_ht, id, 5, oi)
        call SaveInteger(cl_ht, id, 6, ms)
        call CL_Add("U," + I2S(id) + "," + CL_T() + "," + R2SW(xi * 0.5, 1, 1) + "," + R2SW(yi * 0.5, 1, 1) + "," + I2S(fi) + "," + I2S(oi) + "," + I2S(ms))
    endif
    if hi != LoadInteger(cl_ht, id, 4) then
        call SaveInteger(cl_ht, id, 4, hi)
        call CL_Add("H," + I2S(id) + "," + CL_T() + "," + I2S(hi))
    endif
    set u = null
endfunction

// Framework state: scores (leaderboard), ante, number of key units, time left.
function CL_Watch takes nothing returns nothing
    local integer i = 1
    local integer k
    loop
        exitwhen i > 8
        if udg_Integers_Scores[i] != cl_sc[i] then
            set cl_sc[i] = udg_Integers_Scores[i]
            call CL_Add("SC," + CL_T() + "," + I2S(i) + "," + I2S(cl_sc[i]))
        endif
        set i = i + 1
    endloop
    if udg_Integer_Ante != cl_ante then
        set cl_ante = udg_Integer_Ante
        call CL_Add("AN," + CL_T() + "," + I2S(cl_ante))
    endif
    set k = CountUnitsInGroup(udg_UnitGroup_KeyUnits)
    if k != cl_ku then
        set cl_ku = k
        call CL_Add("KU," + CL_T() + "," + I2S(k))
    endif
    set k = R2I(TimerGetRemaining(udg_Timer_TimeLeft))
    if k != cl_tl then
        set cl_tl = k
        call CL_Add("TL," + CL_T() + "," + I2S(k))
    endif
endfunction

function CL_Sample takes nothing returns nothing
    if not cl_on then
        return
    endif
    set cl_tickn = cl_tickn + 1
    call GroupEnumUnitsInRect(cl_grp, bj_mapInitialPlayableArea, null)
    call ForGroup(cl_grp, function CL_SampleEnum)
    call GroupClear(cl_grp)
    call CL_Watch()
endfunction

function CL_SetRate takes real r returns nothing
    set cl_rate = r
    call TimerStart(cl_tick, cl_rate, true, function CL_Sample)
endfunction

function CL_OnOrder takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local eventid e = GetTriggerEventId()
    if e == EVENT_PLAYER_UNIT_ISSUED_POINT_ORDER then
        call CL_Add("OP," + CL_T() + "," + CL_Id(u) + "," + I2S(GetIssuedOrderId()) + "," + R2SW(GetOrderPointX(), 1, 1) + "," + R2SW(GetOrderPointY(), 1, 1))
    elseif e == EVENT_PLAYER_UNIT_ISSUED_TARGET_ORDER then
        call CL_Add("OT," + CL_T() + "," + CL_Id(u) + "," + I2S(GetIssuedOrderId()) + "," + I2S(GetHandleId(GetOrderTarget())) + "," + R2SW(GetWidgetX(GetOrderTarget()), 1, 1) + "," + R2SW(GetWidgetY(GetOrderTarget()), 1, 1))
    else
        call CL_Add("OI," + CL_T() + "," + CL_Id(u) + "," + I2S(GetIssuedOrderId()))
    endif
    set u = null
endfunction

function CL_OnSpell takes nothing returns nothing
    local unit u = GetTriggerUnit()
    local eventid e = GetTriggerEventId()
    local string k = "??"
    if e == EVENT_PLAYER_UNIT_SPELL_CHANNEL then
        set k = "CH"
    elseif e == EVENT_PLAYER_UNIT_SPELL_CAST then
        set k = "CA"
    elseif e == EVENT_PLAYER_UNIT_SPELL_EFFECT then
        set k = "EF"
    elseif e == EVENT_PLAYER_UNIT_SPELL_FINISH then
        set k = "FI"
    elseif e == EVENT_PLAYER_UNIT_SPELL_ENDCAST then
        set k = "EN"
    endif
    call CL_Add("S" + k + "," + CL_T() + "," + CL_Id(u) + "," + I2S(GetSpellAbilityId()) + "," + CL_Id(GetSpellTargetUnit()) + "," + R2SW(GetSpellTargetX(), 1, 1) + "," + R2SW(GetSpellTargetY(), 1, 1))
    set u = null
endfunction

function CL_OnDamage takes nothing returns nothing
    local unit v = GetTriggerUnit()
    local unit s = GetEventDamageSource()
    call CL_Add("D," + CL_T() + "," + CL_Id(v) + "," + CL_Id(s) + "," + R2SW(GetEventDamage(), 1, 2) + "," + R2SW(GetUnitX(v), 1, 1) + "," + R2SW(GetUnitY(v), 1, 1) + "," + R2SW(GetUnitX(s), 1, 1) + "," + R2SW(GetUnitY(s), 1, 1) + "," + R2SW(GetWidgetLife(v), 1, 1))
    set v = null
    set s = null
endfunction

function CL_OnDeath takes nothing returns nothing
    local unit v = GetTriggerUnit()
    call CL_Add("K," + CL_T() + "," + CL_Id(v) + "," + CL_Id(GetKillingUnit()) + "," + R2SW(GetUnitX(v), 1, 1) + "," + R2SW(GetUnitY(v), 1, 1))
    set v = null
endfunction

function CL_OnAttacked takes nothing returns nothing
    local unit v = GetTriggerUnit()
    local unit a = GetAttacker()
    call CL_Add("A," + CL_T() + "," + CL_Id(a) + "," + CL_Id(v) + "," + R2SW(GetUnitX(a), 1, 1) + "," + R2SW(GetUnitY(a), 1, 1) + "," + R2SW(GetUnitX(v), 1, 1) + "," + R2SW(GetUnitY(v), 1, 1) + "," + R2SW(GetUnitFacing(a), 1, 1))
    set v = null
    set a = null
endfunction

function CL_ClearMap takes nothing returns nothing
    local group g = CreateGroup()
    local unit u
    call GroupEnumUnitsInRect(g, bj_mapInitialPlayableArea, null)
    loop
        set u = FirstOfGroup(g)
        exitwhen u == null
        call GroupRemoveUnit(g, u)
        call RemoveUnit(u)
    endloop
    call DestroyGroup(g)
    set g = null
endfunction

function CL_CamTo takes rect r returns nothing
    call SetCameraBoundsToRectForPlayerBJ(Player(0), r)
    call PanCameraToTimedForPlayer(Player(0), GetRectCenterX(r), GetRectCenterY(r), 0)
endfunction

// End the intro cinematic without starting a game; make a leaderboard like Intro End does.
function CL_Lab takes nothing returns nothing
    local integer i = 1
    call DisableTrigger(gg_trg_Intro_Body)
    call DisableTrigger(gg_trg_Intro_End)
    call DisableTrigger(gg_trg_Camera)
    call TriggerExecute(gg_trg_Disable)
    call CinematicModeBJ(false, GetPlayersAll())
    call ResetToGameCameraForPlayer(Player(0), 0)
    call EndThematicMusic()
    call SetSkyModel(null)
    call FogMaskEnableOff()
    call FogEnableOff()
    call CinematicFadeBJ(bj_CINEFADETYPE_FADEIN, 0.5, "ReplaceableTextures\\CameraMasks\\Black_mask.blp", 0, 0, 0, 0)
    call CL_ClearMap()
    if GetLastCreatedLeaderboard() == null then
        call CreateLeaderboardBJ(GetPlayersAll(), "CL lab")
        loop
            exitwhen i > 8
            if GetPlayerSlotState(Player(i - 1)) == PLAYER_SLOT_STATE_PLAYING then
                call LeaderboardAddItemBJ(Player(i - 1), GetLastCreatedLeaderboard(), GetPlayerName(Player(i - 1)), 0)
            endif
            set i = i + 1
        endloop
    endif
    set udg_Integer_GameLength = 999
    call CL_CamTo(cl_lab)
    call CL_Msg("lab ready (match length 999)")
endfunction

function CL_Go takes integer n returns nothing
    set cl_force = n
    call PauseTimer(udg_Timer_TimeLeft)
    call DestroyTimerDialogBJ(GetLastCreatedTimerDialogBJ())
    call EnableTrigger(gg_trg_Win)
    call EnableTrigger(gg_trg_Draw)
    call EnableTrigger(gg_trg_Finish)
    call CL_Add("G," + CL_T() + ",go," + I2S(n))
    call TriggerExecute(gg_trg_Next_Event)
endfunction

function CL_Free takes nothing returns nothing
    set udg_Player_Winner = Player(0)
    set udg_Boolean_GameIsOver = true
    set udg_Integer_GamesPlayed = 999
    call TriggerExecute(gg_trg_Disable)
    call SetCameraBoundsToRectForPlayerBJ(Player(0), gg_rct_Clean_Crew)
    call CL_Add("G," + CL_T() + ",free")
    call TriggerExecute(gg_trg_Next_Event)
endfunction

