//=============================================================================
// MrLiu_CharaterZoom.js
//=============================================================================

/*:
 * @plugindesc 在RMMV游戏中的实现类似RM系列作品中近大远小的功能
 * @author MrLiu-过眼云烟
 *
 * @help 使用方法是在地图的备注中加入<Character_zoom:0.7> 即地图上人物会缩放为正常的0.7倍
 * 交通工具不会随之缩放，即行走图名称包含Vehicle的不会随之缩放。
 */
//-----------------------------------------------------------------------------

var _MrLiu_CharaterZoom_update = Sprite_Character.prototype.update;
Sprite_Character.prototype.update = function() {
    _MrLiu_CharaterZoom_update.call(this);
	var map = $dataMap;
    if(map.meta.Character_zoom && (this._characterName.indexOf("Vehicle")!= 0) ){//Cts.indexOf("Text") > 0
		this.scale.x = map.meta.Character_zoom;
		this.scale.y = map.meta.Character_zoom;
    };
};