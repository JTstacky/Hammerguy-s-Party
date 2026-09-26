    // ---- Claude instrumentation globals (Uther Party 4.0 CL) ----
    string array            cl_buf
    integer                 cl_n                       = 0
    string                  cl_line                    = ""
    integer                 cl_file                    = 0
    timer                   cl_clock                   = null
    real                    cl_base                    = 0.0
    timer                   cl_tick                    = null
    real                    cl_rate                    = 0.1
    integer                 cl_tickn                   = 0
    boolean                 cl_on                      = true
    hashtable               cl_ht                      = null
    group                   cl_grp                     = null
    trigger                 cl_dmg                     = null
    integer                 cl_force                   = 0
    rect                    cl_lab                     = null
    boolean                 cl_follow                  = false
    timer                   cl_ftimer                  = null
    real                    cl_fx                      = 0.0
    real                    cl_fy                      = 0.0
    integer                 cl_fn                      = 0
    integer array           cl_sc
    integer                 cl_ante                    = -99
    integer                 cl_ku                      = -1
    integer                 cl_tl                      = -1
    integer                 cl_tour                    = 0
    integer                 cl_tour_end                = 0
    real                    cl_cap                     = 0.0
    timer                   cl_captimer                = null
    integer                 cl_gseq                    = 0
    integer                 cl_gnum                    = 0
    unit                    cl_dodge_v                 = null
    integer                 cl_dodge_dir               = 1
    real                    cl_dodge_delay             = 0.0
    timer                   cl_dodge_timer             = null
    timer                   cl_dodge_timer2            = null
    integer                 cl_dodge_mode              = 0
    unit                    cl_orphan_s                = null
    real                    cl_orphan_delay            = 0.0
    boolean                 cl_bot                     = false
    real                    cl_botr                    = 500.0
    real                    cl_bx                      = 0.0
    real                    cl_by                      = 0.0
    timer                   cl_bottimer                = null
    string array            cl_oi
    string array            cl_op
    string array            cl_ot
    integer                 cl_noi                     = 0
    integer                 cl_nop                     = 0
    integer                 cl_not                     = 0
