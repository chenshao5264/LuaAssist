--
-- Author: soul
-- Date: 2020/2/13 18:48:29
-- Brief: 
--

local M = Class(requireLua("VBase"))

M.args = {
    btnShade  = Types.Button,
    textTitle = Types.Text,
    textGrade = Types.Text,
    imgGrade = Types.Image,

    goSpine = Types.GameObject,
}

local _ARGS = clone(M.args)

function M:Awake()
    self:setPorxy(_ARGS)

    V.playOpenPanelAction(self._gameObject)

    self._textTitle:setLang(STR("arena_desc_24"))

    -- self._btnShade

    -- @unity.type Spine.Unity.SkeletonGraphic
    self._spineBox = nil

    -- self._spineBox:
end

function M:init()
    M.base.init(self)

    -- local raw = self._goSpine:get("SkeletonGraphic").raw
    -- raw:AddAnimationCompleteDelegate(function(trackName)
    --     raw.startingAnimation = "xunhuan"
    --     raw.startingLoop = true
    --     raw:Initialize(true)
    -- end)

    self._imgGrade:setAtlasSpriteFormat("arena/duanwei_" ..P._playerArena:getMyArenaGrade())
end


function M:closePanel()
    V.closePanel(Views.ArenaGradeUpPanel)
end

function M:OnDestroy()
    M.base.OnDestroy(self)
end

return M