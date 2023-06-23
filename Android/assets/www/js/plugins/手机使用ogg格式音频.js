

/*:
 * @plugindesc ogg播放
 * @无
 *
 * @help 
 */




AudioManager.audioFileExt = function() {
    if (WebAudio.canPlayOgg() && !Utils.isMobileDevice()) {
        return '.ogg';
    } else {
        return '.ogg';
    }
};

//=============================================================================
// 虚拟按键用
//  
//=============================================================================
var paopao=[]
ConfigManager.xuni=false
var paopao_addOptions = Window_Options.prototype.addGeneralOptions;
    Window_Options.prototype.addGeneralOptions = function() {
        paopao_addOptions.apply(this, arguments);
        this.addCommand('虚拟按键', 'xuni');
    };
	
   ConfigManager.makeData = function() {
    var config = {};
    config.alwaysDash = this.alwaysDash;
    config.commandRemember = this.commandRemember;
    config.bgmVolume = this.bgmVolume;
    config.bgsVolume = this.bgsVolume;
    config.meVolume = this.meVolume;
    config.seVolume = this.seVolume;
	config.xuni =this.xuni;
    return config;
};	
	
	
	var paopao_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        paopao_applyData.apply(this, arguments);
        this.xuni = this.readFlag(config, 'xuni');
    };
	
paopao_Game_Map_refresh_Window_Options_changeValue = Window_Options.prototype.changeValue;
Window_Options.prototype.changeValue = function(symbol, value) {
    paopao_Game_Map_refresh_Window_Options_changeValue.call(this,symbol,value);
	if (symbol=="xuni") {
		if(ConfigManager.xuni==true){
			paopao.xuni =true
		}else{
			paopao.xuni =false
		}
        this.refresh();
    }
	
};
	
var paopao_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        paopao_start.apply(this, arguments);
      if (ConfigManager.xuni)  {paopao.xuni =true}
    };	


//=============================================================================
// 菜单可用
//  
//=============================================================================
Window_MenuCommand.prototype.addMainCommands = function() {
    var enabled = this.areMainCommandsEnabled();
    if (this.needsCommand('item')&&$gameSwitches.value(234) == false) {
        this.addCommand(TextManager.item, 'item', enabled);
    }
    if (this.needsCommand('skill')) {
        this.addCommand(TextManager.skill, 'skill', enabled);
    }
    if (this.needsCommand('equip')) {
        this.addCommand(TextManager.equip, 'equip', enabled);
    }
    if (this.needsCommand('status')) {
        this.addCommand(TextManager.status, 'status', enabled);
    }
};
