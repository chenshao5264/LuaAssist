--
-- Author: soul
-- Date: 2020/3/21 9:31:34
-- Brief: 可以使原始的gameobject添加属性，属性必须以 _ 命名方式开始 
-- 如raw为UI.Text
-- local t = UnityGO.wrapProxy(Text)
-- t.text = '111'访问的是Text.text
-- t._text = '111' 未添加 _text属性

local M = {}

--[[
UnityProxyWrapper = M
--]]

local NEW_INDEX_PREFIX = "_"

function M.wrapProxy(raw)
	local proxy = {
		raw = raw
	}

	setmetatable(proxy, {
		__newindex = function(t, k, v)
			local newIndexFlag = string.sub(k, 1, 1) == NEW_INDEX_PREFIX
			if newIndexFlag then
				rawset(t, k, v)
			else
				raw[k] = v
			end
		end,
		__index = function(t, k)
			local newIndexFlag = string.sub(k, 1, 1) == NEW_INDEX_PREFIX
			if newIndexFlag then
				return rawget(t, k)
			else
				return raw[k]
			end
		end
	})

	return proxy
end

return M