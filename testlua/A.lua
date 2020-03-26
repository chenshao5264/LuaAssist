
local local_MAX_HP = 200
G_MAX_HP = 100
M.MAX_HP = 2000

function M:getHp()
    self._hp = 1
    
    --@type PlayerHero
    self._playerHero = nil
    
end

-- local HERO_STATUS_LOCAL = {
--     IDLE = 1,
--     WALK = 2,
--     ATTACK = 3,

--     SKILL = {
--         1,
--         2,
--         {
--             _3_1 = 1,
--             _3_2 = 2,
--         }
--     }
-- }

-- HERO_STATUS_G = {
--     IDLE_G = 1,
--     WALK_G = 2,
--     ATTACK_G = 3,

--     SKILL_G = {
--         1,
--         2,
--         {
--             _3_1 = 1,
--             _3_2 = 2,
--         }
--     }
-- }

M.HERO_STATUS = {
    IDLE = 1,
    WALK = 2,
    ATTACK = 3,

    SKILL = {
        1,
        2,
        {
            _3_1 = 1,
            _3_2 = 2,
            _3_3 = {
                _4_1 = 1
            }
        }
    }
}



-- HERO_STATUS.ATTACK

-- HERO_STATUS.IDLE


-- Skill

-- local a

-- HERO_STATUS.SKILL

-- HERO_STATUS.SKILL.


-- HERO_STATUS.
 
-- function M.getMaxHp() 

-- end

-- function getAtk()
-- end

-- local function getDef()

-- end


-- local getAAA = function()
    
-- end


