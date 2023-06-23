//=============================================================================
// TMPlugin - ネームポップ
// バージョン: 2.0.0
// 最終更新日: 2016/08/12
// 配布元    : http://hikimoki.sakura.ne.jp/
//-----------------------------------------------------------------------------
// Copyright (c) 2016 tomoaky
// Released under the MIT license.
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc 事件顶部添加显示文字的功能。
 *
 * @author tomoaky (http://hikimoki.sakura.ne.jp/)
 *
 * @param backOpacity
 * @text 背景不透明度
 * @desc 显示名称背景的不透明度。
 * 初始值: 96 ( 0 ～ 255 )
 * @default 96
 *
 * @param fontSize
 * @text 字体大小
 * @desc 显示名称窗口的字体大小。
 * 初始值: 20
 * @default 20
 *
 * @param outlineWidth
 * @text 轮廓宽度
 * @desc 显示名称窗口的轮廓粗细。
 * 初始值: 4
 * @default 4
 *
 * @param outlineColor
 * @text 轮廓颜色
 * @desc 显示名称窗口的轮廓颜色。
 * 初始值: rgba(0, 0, 0, 0.5)
 * @default rgba(0, 0, 0, 0.5)
 *
 * @param width
 * @text 宽度
 * @desc 显示名称窗口的宽度
 * 初始值: 160
 * @default 160
 *
 * @param roundRectRadius
 * @text 半径
 * @desc 导入TMBitmapEx.js时，圆角矩形圆形部分的半径。
 * 初始值: 6
 * @default 6
 *
 * @help
 * 使用方法:
 *
 *   可以通过在事件的备注栏(或注释)中写入标签，
 *   或者稍后使用插件命令设置名称文本，
 *   在事件的头部显示文字。
 *
 *   打开事件透明度时，也会隐藏显示名称窗口。
 *   如果只想显示名称窗口，请将事件的图像设置为(无)。
 *
 *   该插件正在RPG工具mv版本1.3.0中进行测试。
 *
 *
 * 插件命令:
 *
 *   namePop 1 名字
 *     在事件1的头上显示名称文字。
 *
 *   namePop 1 名字 -48
 *     将显示的名称窗口向上偏移48点显示。
 *
 *   namePop 1 名字 -48 blue
 *     设置显示名称窗口的边框颜色为蓝色。
 *
 *   namePop 1
 *     清除事件1的名称窗口。
 *
 *   事件编号（第一个编号）根据以下规则设置目标。
 *     -1     … 以玩家为目标
 *     0      … 以正在执行命令的事件为目标(本事件)
 *     1 以上 … 以指定编号的事件为目标
 *
 *
 * 备注栏(事件)标签:
 *
 *   <namePop:名前 12 red>
 *     将名称文字在头上向下移动12个点，使文字边框显示为红色。
 *
 *   除了事件的备注栏以外，
 *   还可以在事件指令中的【注释】中使用该标签。
 *   如果备注栏和注释都有标签，则注释优先。
 *
 *   显示名称也可以使用某些控制字符。
 *   \V, \N, \P, \G, \\, \C 可用，用法与『显示文字』相同，
 *   \C更改整个名称窗口的文字颜色。
 *
 *   只有在插件命令或事件页面切换导致名称发生更改时，
 *   才会执行控制字符替换。 也就是说，如果在\V中将变量值设置为名称，
 *   然后将变量值更改为其他值，名称显示窗口将保持不变。
 *
 *
 * 插件参数补充:
 *
 *   namePopOutlineColor
 *     轮廓颜色以类似于rgba(0, 0, 0, 0.5)的格式设置RGB值和不透明度。
 *    请将RGB值设定在0~255、不透明度设置在0~1.0的范围内。
 *       例: rgba(255, 0, 255, 0.5)    # 不透明度为50%的粉红色
 *
 *     除了上述格式之外，还可以设置black和blue等颜色名称，
 *     以及类似#000000和#0000ff的颜色代码。
 *
 *   roundRectRadius
 *     通过将TMBitmapEx.js引入此插件之上的位置，
 *     并将此参数的值设置为1或更大，
 *     可以将名称显示背景设置为圆角矩形。
 */

var Imported = Imported || {};
Imported.TMNamePop = true;

var TMPlugin = TMPlugin || {};
TMPlugin.NamePop = {};
TMPlugin.NamePop.Parameters = PluginManager.parameters('TMNamePop');
TMPlugin.NamePop.BackOpacity =  +(TMPlugin.NamePop.Parameters['backOpacity'] || 96);
TMPlugin.NamePop.FontSize = +(TMPlugin.NamePop.Parameters['fontSize'] || 20);
TMPlugin.NamePop.OutlineWidth = +(TMPlugin.NamePop.Parameters['outlineWidth'] || 4);
TMPlugin.NamePop.OutlineColor = TMPlugin.NamePop.Parameters['outlineColor'] || 'rgba(0, 0, 0, 0.5)';
TMPlugin.NamePop.Width = +(TMPlugin.NamePop.Parameters['width'] || 160);
TMPlugin.NamePop.RoundRectRadius = +(TMPlugin.NamePop.Parameters['roundRectRadius'] || 6);


if (!TMPlugin.EventBase) {
  TMPlugin.EventBase = true;
  (function() {

    var _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
      _Game_Event_setupPage.call(this);
      if (this._pageIndex >= 0) this.loadCommentParams();
    };

    Game_Event.prototype.loadCommentParams = function() {
      this._commentParams = {};
      var re = /<([^<>:]+)(:?)([^>]*)>/g;
      var list = this.list();
      for (var i = 0; i < list.length; i++) {
        var command = list[i];
        if (command && command.code == 108 || command.code == 408) {
          for (;;) {
            var match = re.exec(command.parameters[0]);
            if (match) {
              this._commentParams[match[1]] = match[2] === ':' ? match[3] : true;
            } else {
              break;
            }
          }
        } else {
          break;
        }
      }
    };

    Game_Event.prototype.loadTagParam = function(paramName) {
      return this._commentParams[paramName] || this.event().meta[paramName];
    };

  })();
} // TMPlugin.EventBase

if (!TMPlugin.InterpreterBase) {
  TMPlugin.InterpreterBase = true;
  (function() {

    Game_Interpreter.prototype.convertEscapeCharactersTM = function(text) {
      text = text.replace(/\\/g, '\x1b');
      text = text.replace(/\x1b\x1b/g, '\\');
      text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
        return $gameVariables.value(parseInt(arguments[1]));
      }.bind(this));
      text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
        return $gameVariables.value(parseInt(arguments[1]));
      }.bind(this));
      text = text.replace(/\x1bN\[(\d+)\]/gi, function() {
        return this.actorNameTM(parseInt(arguments[1]));
      }.bind(this));
      text = text.replace(/\x1bP\[(\d+)\]/gi, function() {
        return this.partyMemberNameTM(parseInt(arguments[1]));
      }.bind(this));
      text = text.replace(/\x1bG/gi, TextManager.currencyUnit);
      return text;
    };
  
    Game_Interpreter.prototype.actorNameTM = function(n) {
      var actor = n >= 1 ? $gameActors.actor(n) : null;
      return actor ? actor.name() : '';
    };

    Game_Interpreter.prototype.partyMemberNameTM = function(n) {
      var actor = n >= 1 ? $gameParty.members()[n - 1] : null;
      return actor ? actor.name() : '';
    };

  })();
} // TMPlugin.InterpreterBase

(function() {

  //-----------------------------------------------------------------------------
  // Game_CharacterBase
  //

  Game_CharacterBase.prototype.setNamePop = function(namePop, shiftY) {
    if (namePop) {
      namePop = $gameMap._interpreter.convertEscapeCharactersTM(namePop);
    }
    this._namePop  = namePop;
    this._namePopY = shiftY || 0;
  };

  Game_CharacterBase.prototype.namePopOutlineColor = function() {
    return this._namePopOutlineColor || TMPlugin.NamePop.OutlineColor;
  };
  
  Game_CharacterBase.prototype.setNamePopOutlineColor = function(outlineColor) {
    this._namePopOutlineColor = outlineColor;
  };
  
  Game_CharacterBase.prototype.requestNamePop = function() {
    this._requestNamePop = true;
  };

  Game_CharacterBase.prototype.onChangeNamePop = function() {
    this._requestNamePop = false;
  };

  Game_CharacterBase.prototype.isNamePopRequested = function() {
    return this._requestNamePop;
  };

  //-----------------------------------------------------------------------------
  // Game_Event
  //

  var _Game_Event_setupPage = Game_Event.prototype.setupPage;
  Game_Event.prototype.setupPage = function() {
    _Game_Event_setupPage.call(this);
    if (this._pageIndex >= 0) {
      var namePop = this.loadTagParam('namePop');
      if (namePop) {
        var arr = namePop.split(' ');
        this.setNamePop(arr[0], arr[1]);
        this.setNamePopOutlineColor(arr[2]);
      }
    } else {
      this.setNamePop(null, 0);
    }
    this.requestNamePop();
  };
  
  //-----------------------------------------------------------------------------
  // Game_Interpreter
  //

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'namePop') {
      var arr = args.map(this.convertEscapeCharactersTM, this);
      var character = this.character(+arr[0]);
      if (character) {
        character.setNamePop(args[1], arr[2]);
        character.setNamePopOutlineColor(arr[3]);
        character.requestNamePop();
      }
    }
  };
  
  //-----------------------------------------------------------------------------
  // Sprite_Character
  //

  var _Sprite_Character_update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function() {
    _Sprite_Character_update.call(this);
    this.updateNamePop();
  };

  Sprite_Character.prototype.updateNamePop = function() {
    if (this._character.isNamePopRequested() ||
        this._namePop !== this._character._namePop) {
      this._character.onChangeNamePop();
      this._namePop = this._character._namePop;
      if (this._namePop) {
        if (!this._namePopSprite) {
          this._namePopSprite = new Sprite_NamePop();
          this.addChild(this._namePopSprite);
          this._namePopSprite.y = this.namePopShiftY();
        }
        this._namePopSprite.refresh(this._namePop,
                                    this._character.namePopOutlineColor());
      } else {
        this.removeChild(this._namePopSprite);
        this._namePopSprite = null;
      }
    }
  };

  Sprite_Character.prototype.namePopShiftY = function() {
    return this._character._namePopY - this.patternHeight();
  };
  
  //-----------------------------------------------------------------------------
  // Sprite_NamePop
  //

  function Sprite_NamePop() {
    this.initialize.apply(this, arguments);
  }

  Sprite_NamePop.prototype = Object.create(Sprite.prototype);
  Sprite_NamePop.prototype.constructor = Sprite_NamePop;

  Sprite_NamePop.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this.bitmap = new Bitmap(TMPlugin.NamePop.Width, TMPlugin.NamePop.FontSize + 4);
    this.bitmap.fontSize = TMPlugin.NamePop.FontSize;
    this.bitmap.outlineWidth = TMPlugin.NamePop.OutlineWidth;
    this.anchor.x = 0.5;
    this.anchor.y = 1;
  };

  Sprite_NamePop.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this.y = this.parent.namePopShiftY();
  };

  Sprite_NamePop.prototype.refresh = function(text, outlineColor) {
    this.bitmap.clear();
    this.bitmap.textColor = '#ffffff';
    this.bitmap.outlineColor = outlineColor;
    text = this.convertEscapeCharacters(text);
    var tw = this.bitmap.measureTextWidth(text);
    var x = Math.max((this.width - tw) / 2 - 4, 0);
    var w = Math.min(tw + 8, this.width);
    this.bitmap.paintOpacity = TMPlugin.NamePop.BackOpacity;
    if (Imported.TMBitmapEx && TMPlugin.NamePop.RoundRectRadius) {
      this.bitmap.fillRoundRect(x, 0, w, this.height, TMPlugin.NamePop.RoundRectRadius, '#000000');
    } else {
      this.bitmap.fillRect(x, 0, w, this.height, '#000000');
    }
    this.bitmap.paintOpacity = 255;
    this.bitmap.drawText(text, 0, 0, this.width, this.height, 'center');
  };
  
  Sprite_NamePop.prototype.convertEscapeCharacters = function(text) {
    text = text.replace(/\x1bC\[(\d+)\]/gi, function() {
      this.bitmap.textColor = this.textColor(arguments[1]);
      return '';
    }.bind(this));
    return text;
  };

  Sprite_NamePop.prototype.textColor = function(n) {
    var px = 96 + (n % 8) * 12 + 6;
    var py = 144 + Math.floor(n / 8) * 12 + 6;
    var windowskin = ImageManager.loadSystem('Window');
    return windowskin.getPixel(px, py);
  };

})();
