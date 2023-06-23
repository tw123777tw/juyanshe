//=============================================================================
// KMS_MapActiveMessage.js
//   Last update: 2022/05/22
//=============================================================================

/*:
 * @plugindesc
 * [v0.3.2] 自动显示地图上事件的消息。
 * 
 * @author Kameo (Kamesoft)
 *
 * @param Balloon offset Y
 * @default 20
 * @desc Vertical position offset for balloons by pixel.
 *
 * @param Balloon margin
 * @default -8
 * @desc Adjust frame size of balloons by pixel.
 *
 * @param Default range
 * @default 4
 * @desc Default distance for displaying message by tile unit.
 *
 * @param Display duration
 * @default 300
 * @desc Display frame count.
 *
 * @param Max message count
 * @default 10
 * @desc Max number of active messages.
 *
 * @param Message skin
 * @default ActiveMessageSkin
 * @require 1
 * @dir img/system/
 * @type file
 * @desc Message skin for active message. Load from img/system.
 *
 *
 * @help
 *
 * ## Plugin command
 * <ActiveMessage: 这是一个陌生的村庄> //这是注释
 *MapActiveMessage enable#启用活动消息
 *MapActiveMessage disable#显示活动消息
 *MapActiveMessage show 10#显示ID为10的事件的消息
 *MapActiveMessage show#显示所有事件的消息
 *
 */

/*:ja
 * @plugindesc
 * [v0.3.2] プレイヤーが近付いたときに、自動的にメッセージを表示するイベントを作成します。
 * 
 * @author かめお (Kamesoft)
 *
 * @param Balloon offset Y
 * @default 20
 * @desc 吹き出しの縦方向の位置をピクセル単位で調整します。
 *
 * @param Balloon margin
 * @default -8
 * @desc 吹き出しの枠サイズをピクセル単位で調整します。
 *
 * @param Default range
 * @text 距离
 * @default 4
 * @desc メッセージを表示する距離をタイル単位で指定します。
 *
 * @param Display duration
 * @default 300
 * @desc メッセージ表示時間をフレーム単位で指定します。
 *
 * @param Max message count
 * @default 10
 * @desc 表示できるメッセージの最大数です。
 *
 * @param Message skin
 * @default ActiveMessageSkin
 * @require 1
 * @dir img/system/
 * @type file
 * @desc メッセージの表示に使用するスキン画像です。 img/system から読み込みます。
 *
 *
 * @help
 *
 * ■ プラグインコマンド
 * <ActiveMessage: 这是一个陌生的村庄> //这是注释
 * MapActiveMessage enable      # アクティブメッセージを有効にします。
 * MapActiveMessage disable     # アクティブメッセージを無効にします。
 * MapActiveMessage show 10     # イベント ID:10 のメッセージを表示します。
 * MapActiveMessage show        # 全イベントのメッセージを表示します。
 *
 */

var KMS = KMS || {};

(function() {

'use strict';

// 定数
var Const =
{
    debug:      false,              // デバッグモード
    pluginCode: 'MapActiveMessage', // プラグインコード
    regex: {
        activeMessage:   /<(?:アクティブメッセージ|ActiveMessage)\s*[:\s]\s*([^>]+)>/i,
        displayRange:    /<(?:アクティブメッセージ距離|ActiveMessageRange)\s*[:\s]\s*(\d+)>/i,
        displayDuration: /<(?:アクティブメッセージ表示時間|ActiveMessageDuration)\s*[:\s]\s*(\d+)>/i,
        loopMessage:     /<(?:アクティブメッセージループ|ActiveMessageLoop)>/i,
        beginMessage:    /<(?:アクティブメッセージ|ActiveMessage)\s*[:\s][^>]+$/i,
        endMessage:      /([^>]*)>/
    },

    balloonFrameInfo:  { margin: 4, size: 24, lineLength: 48, srcSize: 96 },
    balloonVertexSize: { width: 24, height: 48 },

    // 吹き出しの表示位置
    balloonPosition: { below: 0, above: 1 }
};

var PluginName = 'KMS_' + Const.pluginCode;

KMS.imported = KMS.imported || {};
KMS.imported[Const.pluginCode] = true;

function isNullOrUndefined(value)
{
    return value === null || value === undefined;
}

// デフォルト値つきで文字列から int を解析
function parseIntWithDefault(param, defaultValue)
{
    var value = parseInt(param);
    return isNaN(value) ? defaultValue : value;
}

var pluginParams = PluginManager.parameters(PluginName);
var Params = {};
Params.messageSkin     = pluginParams['Message skin'] || 'ActiveMessageSkin';
Params.messageCountMax = Math.max(parseIntWithDefault(pluginParams['Max message count'], 8), 1);
Params.balloonOffsetY  = parseIntWithDefault(pluginParams['Balloon offset Y'], 20);
Params.balloonMargin   = parseIntWithDefault(pluginParams['Balloon margin'], -8);
Params.defaultRange    = Math.max(parseIntWithDefault(pluginParams['Default range'], 4), 1);
Params.displayDuration = Math.max(parseIntWithDefault(pluginParams['Display duration'], 300), 1);
Params.fadeFrameCount  = Math.max(parseIntWithDefault(pluginParams['Fade frame count'], 8), 1);
Params.fontSize        = Math.max(parseIntWithDefault(pluginParams['Font size'], 18), 1);

// デバッグログ
var debuglog;
if (Const.debug)
{
    debuglog = function() { console.log(arguments); };
}
else
{
    debuglog = function() { };
}

var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args)
{
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command !== Const.pluginCode)
    {
        return;
    }

    switch (args[0])
    {
    case 'enable':      // 有効化
        $gameSystem.setMapActiveMessageEnabled(true);
        break;

    case 'disable':     // 無効化
        $gameSystem.setMapActiveMessageEnabled(false);
        break;

    case 'show':        // 強制表示 (eventId)
        // eventId 省略時 (undefined) は全イベントが対象
        $gameMap.forceDisplayActiveMessage(parseInt(args[1]));
        break;

    default:
        // 不明なコマンド
        console.error('[%s %s] Unknown command.', Const.pluginCode, args[0]);
        break;
    }
};

// タイリング描画
function tileBlt(dstImage, srcImage, sx, sy, sw, sh, dx, dy, dw, dh)
{
    for (var offY = 0; offY < dh; offY += sh)
    {
        for (var offX = 0; offX < dw; offX += sw)
        {
            var tempSh = Math.min(sh, dh - offY);
            var tempSw = Math.min(sw, dw - offX);
            dstImage.blt(
                srcImage,
                sx, sy, tempSw, tempSh,
                dx + offX, dy + offY, tempSw, tempSh
            );
        }
    }
}


//-----------------------------------------------------------------------------
// Game_Temp

var _Game_Temp_initialize = Game_Temp.prototype.initialize;
Game_Temp.prototype.initialize = function()
{
    _Game_Temp_initialize.call(this);

    this.clearMapActiveMessage();
};

/**
 * アクティブメッセージの登録
 */
Game_Temp.prototype.pushMapActiveMessages = function(targetEvent, messages, needsLoop, isForced)
{
    var message =
    {
        id: this._mapActiveMessageNextId++,
        event: targetEvent,
        messages: messages,
        needsLoop: needsLoop,
        isForced: isForced
    };
    this._mapActiveMessages.push(message);
};

/**
 * アクティブメッセージのクリア
 */
Game_Temp.prototype.clearMapActiveMessage = function()
{
    this._mapActiveMessageNextId = 0;
    this._mapActiveMessages = [];
};

/**
 * 次のアクティブメッセージを取得
 */
Game_Temp.prototype.popNextMapActiveMessage = function()
{
    return this._mapActiveMessages.shift();
};

/**
 * アクティブメッセージが登録されているか
 */
Game_Temp.prototype.isMapActiveMessageReady = function()
{
    return this._mapActiveMessages.length > 0;
};


//-----------------------------------------------------------------------------
// Game_System

/**
 * アクティブメッセージの有効状態を取得
 */
Game_System.prototype.isMapActiveMessageEnabled = function()
{
    return !isNullOrUndefined(this._mapActiveMessageEnabled) ?
        this._mapActiveMessageEnabled :
        true;
};

/**
 * アクティブメッセージの有効状態を設定
 */
Game_System.prototype.setMapActiveMessageEnabled = function(enabled)
{
    this._mapActiveMessageEnabled = !!enabled;
};



//-----------------------------------------------------------------------------
// Game_Map

var _Game_Map_setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId)
{
    _Game_Map_setup.call(this, mapId);

    this.initializeActiveMessage();
};

/**
 * アクティブメッセージの初期化
 */
Game_Map.prototype.initializeActiveMessage = function()
{
    // 最初は全イベントの表示済みフラグを解除
    this.clearActiveMessageShownFlags();
};

/**
 * アクティブメッセージの表示済みフラグを解除
 */
Game_Map.prototype.clearActiveMessageShownFlags = function()
{
    this.events().forEach(function(event)
    {
        event.setMapActiveMessageShown(false);
    });

    this.requestUpdateActiveMessage();
};

/**
 * アクティブメッセージの更新要求
 */
Game_Map.prototype.requestUpdateActiveMessage = function()
{
    this._needsUpdateActiveMessage = true;
};

var _Game_Map_update = Game_Map.prototype.update;
Game_Map.prototype.update = function(sceneActive)
{
    _Game_Map_update.call(this, sceneActive);

    this.updateDisplayActiveMessage();
};

/**
 * アクティブメッセージの表示判定
 */
Game_Map.prototype.updateDisplayActiveMessage = function()
{
    if (!this._needsUpdateActiveMessage)
    {
        return;
    }

    this._needsUpdateActiveMessage = false;

    // アクティブメッセージの登録
    var events = $gamePlayer.findAvailableMapActiveMessageEvents();
    events.forEach(function(event)
    {
        $gameTemp.pushMapActiveMessages(
            event,
            event.getMapActiveMessages(),
            event.needsMapActiveMessageLoop());
    });
};

/**
 * アクティブメッセージの強制表示
 */
Game_Map.prototype.forceDisplayActiveMessage = function(eventId)
{
    var invoker = function(event)
    {
        $gameTemp.pushMapActiveMessages(
            event,
            event.getMapActiveMessages(),
            event.needsMapActiveMessageLoop(),
            true);
    };

    if (isNullOrUndefined(eventId) || isNaN(eventId))
    {
        // 全表示
        this.events().forEach(invoker);
    }
    else
    {
        // イベント ID 指定
        this.events().filter(function(event)
        {
            return event.eventId() === eventId;
        }).forEach(invoker);
    }
};

var _Game_Map_refresh = Game_Map.prototype.refresh;
Game_Map.prototype.refresh = function()
{
    _Game_Map_refresh.call(this);

    this.requestUpdateActiveMessage();
};


//-----------------------------------------------------------------------------
// Game_CharacterBase

var _Game_CharacterBase = Game_CharacterBase.prototype.setDirection;
Game_CharacterBase.prototype.setDirection = function(d)
{
    _Game_CharacterBase.call(this, d);

    // 移動時には方向指定があるはずなので、ここでメッセージの更新要求を出す
    if (!isNullOrUndefined($gameMap))
    {
        $gameMap.requestUpdateActiveMessage();
    }
};


//-----------------------------------------------------------------------------
// Game_Player

/**
 * アクティブメッセージを表示可能なイベントを探す
 */
Game_Player.prototype.findAvailableMapActiveMessageEvents = function()
{
    if (!this.canMove())
    {
        return [];
    }

    // 指定距離内でメッセージ未表示のイベントを列挙
    var candidateEvents = $gameMap.events().filter(function(event)
    {
        return event.hasMapActiveMessage() &&
            !event.isMapActiveMessageShown() &&
            this.calcDistanceForMapActiveMessage(event) <= event.getMapActiveMessageRange();
    }, this);

    // 表示済みフラグの解除判定
    $gameMap.events().forEach(function(event)
    {
        var distance = this.calcDistanceForMapActiveMessage(event);
        if (event.isMapActiveMessageShown())
        {
            // メッセージ表示距離から出ていれば表示済みフラグ解除
            if (distance > event.getMapActiveMessageRange())
            {
                event.setMapActiveMessageShown(false);
            }
        }
    }, this);

    return candidateEvents;
};

Game_Player.prototype.calcDistanceForMapActiveMessage = function(event)
{
    var diffX = this.x - event.x;
    var diffY = this.y - event.y;

    return Math.sqrt(diffX * diffX + diffY * diffY);
};


//-----------------------------------------------------------------------------
// Game_Event

var _Game_Event_setupPage = Game_Event.prototype.setupPage;
Game_Event.prototype.setupPage = function()
{
    _Game_Event_setupPage.call(this);

    this.setupMapActiveMessage();
};

/**
 * 現在のページ番号を取得
 */
Game_Event.prototype.pageIndex = function()
{
    return this._pageIndex;
};

/**
 * アクティブメッセージを構築
 */
Game_Event.prototype.setupMapActiveMessage = function()
{
    this._mapActiveMessageList      = [];
    this._mapActiveMessageRange     = Params.defaultRange;
    this._mapActiveMessageDuration  = Params.displayDuration;
    this._needsMapActiveMessageLoop = false;
    this._isMapActiveMessageShown   = false;

    var page = this.page();
    if (isNullOrUndefined(page))
    {
        return;
    }

    var parsed = this.parseCommentForMapActiveMessage(page);
    var mergedComment = parsed.mergedComment;
    var commentUnits = parsed.commentUnits;

    // メッセージ距離を解析
    var rangeMatch = Const.regex.displayRange.exec(mergedComment);
    if (!isNullOrUndefined(rangeMatch))
    {
        this._mapActiveMessageRange =
            Math.max(parseIntWithDefault(rangeMatch[1], Params.defaultRange), 1);
    }

    // ループ設定を解析
    var loopMatch = Const.regex.loopMessage.exec(mergedComment);
    if (!isNullOrUndefined(loopMatch))
    {
        this._needsMapActiveMessageLoop = true;
    }

    commentUnits.forEach(
        function (unit)
        {
            // メッセージ定義を解析
            var messageMatch = Const.regex.activeMessage.exec(unit);
            if (!isNullOrUndefined(messageMatch))
            {
                this._mapActiveMessageList.push(
                    {
                        text: messageMatch[1],
                        duration: this._mapActiveMessageDuration
                    });
            }

            // メッセージ表示時間を解析
            var durationMatch = Const.regex.displayDuration.exec(unit);
            if (!isNullOrUndefined(durationMatch))
            {
                var duration = parseIntWithDefault(durationMatch[1], Params.displayDuration);
                this._mapActiveMessageDuration = duration;

                // 直前のメッセージの duration を変更
                if (this._mapActiveMessageList.length > 0)
                {
                    this._mapActiveMessageList[this._mapActiveMessageList.length - 1]
                        .duration = duration;
                }
            }
        }, this);
};

/**
 * アクティブメッセージ用のコメント解析
 *
 * @param {Object}  page    解析対象のイベントページ
 */
Game_Event.prototype.parseCommentForMapActiveMessage = function(page)
{
    function isComment(command)
    {
        return command && (command.code === 108 || command.code === 408);
    }

    // 注釈以外に達するまで解析
    var commandIndex  = 0;
    var command       = page.list[commandIndex];
    var mergedComment = '';  // コメントを結合した文字列
    var commentUnit   = '';
    var commentUnits  = [];  // 解析単位ごとに結合した文字列のリスト
    var inMessage     = false;
    while (isComment(command))
    {
        if (mergedComment.length > 0)
        {
            mergedComment += '\n';
        }

        var commentText = command.parameters[0];
        mergedComment += commentText;

        if (inMessage)
        {
            if (commentUnit.length > 0)
            {
                commentUnit += '\n';
            }

            commentUnit += commentText;

            if (Const.regex.endMessage.test(commentText))
            {
                commentUnits.push(commentUnit);
                commentUnit = '';
                inMessage = false;
            }
        }
        else
        {
            if (Const.regex.beginMessage.test(commentText))
            {
                commentUnit = commentText;
                inMessage = true;
            }
            else
            {
                commentUnits.push(commentText);
            }
        }

        command = page.list[++commandIndex];
    }

    if (inMessage)
    {
        commentUnits.push(commentUnit);
    }

    return {
        mergedComment: mergedComment,
        commentUnits: commentUnits
    };
}

/**
 * アクティブメッセージを取得
 *
 * @return {String} メッセージ
 */
Game_Event.prototype.getMapActiveMessages = function()
{
    return this._mapActiveMessageList;
};

/**
 * アクティブメッセージが存在するか
 *
 * @return {Boolean} true if exists
 */
Game_Event.prototype.hasMapActiveMessage = function()
{
    return this._mapActiveMessageList.length !== 0;
};

/**
 * アクティブメッセージを表示可能な範囲
 *
 * @return {Number} タイル単位の表示範囲半径
 */
Game_Event.prototype.getMapActiveMessageRange = function()
{
    return this._mapActiveMessageRange;
};

/**
 * アクティブメッセージをループするか
 *
 * @return {Boolean} true if needs loop
 */
Game_Event.prototype.needsMapActiveMessageLoop = function()
{
    return this._needsMapActiveMessageLoop;
};

/**
 * アクティブメッセージを表示するフレーム数
 *
 * @return {Number} 自動消去するまでのフレーム数
 */
Game_Event.prototype.getMapActiveMessageDuration = function()
{
    return this._mapActiveMessageDuration;
};

/**
 * アクティブメッセージを表示済みか
 *
 * @return {Boolean} true if shown
 */
Game_Event.prototype.isMapActiveMessageShown = function()
{
    return this._isMapActiveMessageShown;
};

/**
 * アクティブメッセージ表示済みかどうかを設定
 *
 * @param {Boolean} shown 設定する値
 */
Game_Event.prototype.setMapActiveMessageShown = function(shown)
{
    this._isMapActiveMessageShown = !!shown;
};


//-----------------------------------------------------------------------------
// Sprite_MapActiveMessageBalloon
//
// アクティブメッセージの吹き出し用スプライト

function Sprite_MapActiveMessageBalloon()
{
    this.initialize.apply(this, arguments);
}

Sprite_MapActiveMessageBalloon.prototype = Object.create(Sprite_Base.prototype);
Sprite_MapActiveMessageBalloon.prototype.constructor = Sprite_MapActiveMessageBalloon;

Sprite_MapActiveMessageBalloon.prototype.initialize = function()
{
    Sprite_Base.prototype.initialize.call(this);

    this.anchor.y = 0.5;
    this.initMembers();
};

Sprite_MapActiveMessageBalloon.prototype.initMembers = function()
{
    this._owner = null;
};

/**
 * オーナーウィンドウの設定
 */
Sprite_MapActiveMessageBalloon.prototype.setOwner = function(owner)
{
    this._owner = owner;
};

/**
 * 位置をオーナーウィンドウに合わせる
 */
Sprite_MapActiveMessageBalloon.prototype.followOwner = function()
{
    this.y = this._owner.height / 2;
};

/**
 * サイズをオーナーウィンドウに合わせる
 */
Sprite_MapActiveMessageBalloon.prototype.fitToOwner = function()
{
    if (isNullOrUndefined(this._owner))
    {
        return;
    }

    var frameSize    = Const.balloonFrameInfo.size;
    var vertexHeight = Const.balloonVertexSize.height;
    var heightOffset = (vertexHeight - frameSize) * 2;

    // Bitmap のサイズ調整
    var bitmapWidth = this._owner.width;
    var bitmapHeight = this._owner.height + heightOffset;
    if (isNullOrUndefined(this.bitmap) ||
        (this.width != bitmapWidth || this.height != bitmapHeight))
    {
        this.bitmap = new Bitmap(bitmapWidth, bitmapHeight);
    }
    else
    {
        this.bitmap.clear();
    }

    if (Const.debug)
    {
        this.bitmap.fillRect(0, 0, bitmapWidth, bitmapHeight, 'rgba(160, 255, 160, 0.5)');
    }
};

/**
 * 吹き出しの再描画
 */
Sprite_MapActiveMessageBalloon.prototype.refresh = function()
{
    if (isNullOrUndefined(this._owner))
    {
        return;
    }

    // サイズの調整
    this.fitToOwner();

    // 吹き出しの描画
    var frameSize    = Const.balloonFrameInfo.size;
    var vertexHeight = Const.balloonVertexSize.height;
    var offsetX      = -Params.balloonMargin;
    var offsetY      = vertexHeight - frameSize - Params.balloonMargin;
    this.drawBalloon(
        offsetX,
        offsetY,
        this.width  - offsetX * 2,
        this.height - offsetY * 2
    );
};

/**
 * 吹き出しを描画
 */
Sprite_MapActiveMessageBalloon.prototype.drawBalloon = function(x, y, width, height)
{
    if (isNullOrUndefined(this._owner))
    {
        return;
    }

    this.drawBalloonBackground(x, y, width, height);
    this.drawBalloonFrame(x, y, width, height);
};

/**
 * 吹き出しの背景を描画
 */
Sprite_MapActiveMessageBalloon.prototype.drawBalloonBackground = function(x, y, width, height)
{
    var srcImage = this._owner.getWindowSkin();
    var frame    = Const.balloonFrameInfo;

    var prevOpacity = this.bitmap.paintOpacity;
    this.bitmap.paintOpacity = this._owner.backOpacity;

    // 背景下層
    this.bitmap.blt(
        srcImage,
        0, 0, frame.srcSize, frame.srcSize,
        x + frame.margin, y + frame.margin, width - frame.margin * 2, height - frame.margin * 2
    );

    // 背景上層
    tileBlt(
        this.bitmap, srcImage,
        0, frame.srcSize, frame.srcSize, frame.srcSize,
        x + frame.margin, y + frame.margin, width - frame.margin * 2, height - frame.margin * 2
    );

    this.bitmap.paintOpacity = prevOpacity;
};

/**
 * 吹き出しの枠を描画
 */
Sprite_MapActiveMessageBalloon.prototype.drawBalloonFrame = function(x, y, width, height)
{
    var srcImage     = this._owner.getWindowSkin();
    var vertexOffset = this._owner.getBalloonVertexX();
    var balloonPos   = this._owner.getBalloonPosition();

    var frame      = Const.balloonFrameInfo;
    var vertexSize = Const.balloonVertexSize;

    // 吹き出しの頂点は枠内に収める
    vertexOffset = Math.min(
        Math.max(vertexOffset, 0),
        width - (frame.size * 2 + vertexSize.width)
    );

    // 縦枠 + コーナーを描画
    function drawFrameV(sx, dx, dy)
    {
        this.bitmap.blt(
            srcImage,
            sx, 0, frame.size, frame.size,
            dx, dy, frame.size, frame.size
        );
        this.bitmap.blt(
            srcImage,
            sx, frame.size, frame.size, frame.lineLength,
            dx, dy + frame.size, frame.size, height - frame.size * 2
        );
        this.bitmap.blt(
            srcImage,
            sx, frame.size + frame.lineLength, frame.size, frame.size,
            dx, dy + height - frame.size, frame.size, frame.size
        );
    }

    // 横枠と頂点を描画
    function drawFrameH(sy, dx, dy, showVertex)
    {
        var baseSx     = frame.srcSize + frame.size;
        var frameWidth = width - frame.size * 2;
        var leftWidth  = showVertex ? vertexOffset : frameWidth;

        // 枠線の左側 (頂点がない場合は全体)
        this.bitmap.blt(
            srcImage,
            baseSx, sy, frame.lineLength, frame.size,
            dx, dy, leftWidth, frame.size
        );

        if (!showVertex)
        {
            // 頂点を描画しない
            return;
        }

        // sy > 0 なら下枠、sy === 0 なら上枠のはず
        var newDx = dx + leftWidth;
        var newDy = dy + (sy > 0 ? 0 : -(vertexSize.height - frame.size));

        // 頂点
        var vertexSx = frame.srcSize + (sy > 0 ? 0 : vertexSize.width);
        this.bitmap.blt(
            srcImage,
            vertexSx, frame.srcSize, vertexSize.width, vertexSize.height,
            newDx, newDy, vertexSize.width, vertexSize.height
        );

        if (Const.debug)
        {
            this.bitmap.fillRect(newDx, newDy, vertexSize.width, vertexSize.height, 'rgba(255, 160, 160, 0.5)');
        }

        // 枠線の右側
        var rightWidth = frameWidth - (leftWidth + vertexSize.width);
        if (rightWidth > 0)
        {
            newDx += vertexSize.width;
            this.bitmap.blt(
                srcImage,
                baseSx, sy, frame.lineLength, frame.size,
                newDx, dy, rightWidth, frame.size
            );
        }
    }

    // 左枠
    drawFrameV.call(this, frame.srcSize, x, y);

    // 右枠
    drawFrameV.call(this, frame.srcSize + frame.size + frame.lineLength, x + width - frame.size, y);

    // 上枠 + 頂点
    drawFrameH.call(
        this,
        0, x + frame.size, y,
        balloonPos === Const.balloonPosition.below
    );

    // 下枠 + 頂点
    drawFrameH.call(
        this,
        frame.size + frame.lineLength, x + frame.size, y + height - frame.size,
        balloonPos === Const.balloonPosition.above
    );
};


//-----------------------------------------------------------------------------
// Sprite_Character

/**
 * 同一のイベントか判定
 */
Sprite_Character.prototype.isSameEvent = function(event)
{
    if (isNullOrUndefined(this._character) ||
        isNullOrUndefined(event) ||
        !(this._character instanceof Game_Event))
    {
        return false;
    }

    return this._character.eventId() === event.eventId();
};


//-----------------------------------------------------------------------------
// Spriteset_Map

/**
 * 指定されたイベントに対応するキャラクタースプライトを取得
 */
Spriteset_Map.prototype.findCharacterSpriteByEvent = function(event)
{
    var sameSprites = this._characterSprites.filter(function(sprite)
    {
        return sprite.isSameEvent(event);
    });

    if (sameSprites.length > 0)
    {
        return sameSprites[0];
    }
    else
    {
        return null;
    }
};


//-----------------------------------------------------------------------------
// Window_MapActiveMessage
//
// マップ上でアクティブメッセージを表示するウィンドウ
// (スプライトでも良いが、メッセージ周りはウィンドウの方が扱いやすい)

function Window_MapActiveMessage()
{
    this.initialize.apply(this, arguments);
}

Window_MapActiveMessage.prototype = Object.create(Window_Base.prototype);
Window_MapActiveMessage.prototype.constructor = Window_MapActiveMessage;

// メッセージの一時描画バッファ
Window_MapActiveMessage.tempMessageBuffer = null;

/**
 * アクティブメッセージ用スキンの事前読み込み
 */
Window_MapActiveMessage.preloadWindowskin = function()
{
    ImageManager.loadSystem(Params.messageSkin);
};

Window_MapActiveMessage.prototype.initialize = function()
{
    // コンテンツサイズは内容に応じて可変なので、ウィンドウサイズは仮
    Window_Base.prototype.initialize.call(this, 0, 0, 64, 64);

    if (isNullOrUndefined(Window_MapActiveMessage.tempMessageBuffer))
    {
        Window_MapActiveMessage.tempMessageBuffer =
            new Bitmap(Graphics.boxWidth, Graphics.boxHeight / 2);
    }

    this._balloonSprite = null;

    this.opacity         = 0;
    this.contentsOpacity = 0;
    this.initMembers();
};

Window_MapActiveMessage.prototype.standardFontSize = function()
{
    return Params.fontSize;
};

Window_MapActiveMessage.prototype.loadWindowskin = function()
{
    // デフォルトのスキンの代わりに、アクティブメッセージ用のスキンを読み込む
    this._windowskin = ImageManager.loadSystem(Params.messageSkin);
};

/**
 * ウィンドウスキンを取得
 */
Window_MapActiveMessage.prototype.getWindowSkin = function()
{
    return this._windowskin;
};

Window_MapActiveMessage.prototype.initMembers = function()
{
    this._message         = null;
    this._pendingMessages = [];
    this._textState       = null;
    this._event           = null;
    this._characterSprite = null;
    this._targetPageIndex = 0;
    this._duration        = 0;
    this._isHiding        = false;
    this._balloonPosition = Const.balloonPosition.above;
};

Window_MapActiveMessage.prototype.printDebug = function(message)
{
    if (Const.debug)
    {
        console.log('[MapActiveMessage] ' + this.getId() + ': ' + message);
    }
};

Window_MapActiveMessage.prototype.show = function()
{
    Window_Base.prototype.show.call(this);

    if (!isNullOrUndefined(this._balloonSprite))
    {
        this._balloonSprite.show();
    }
};

Window_MapActiveMessage.prototype.hide = function()
{
    // ロールバック処理中はメッセージ無しで呼ばれる
    if (this._message)
    {
        this.printDebug('Hide');
    }

    this._duration = 0;
    this._isHiding = true;

    Window_Base.prototype.hide.call(this);

    if (!isNullOrUndefined(this._balloonSprite))
    {
        this._balloonSprite.hide();
    }
};

/**
 * フェードアウト
 */
Window_MapActiveMessage.prototype.fadeOut = function()
{
    if (this.isFadingOut())
    {
        return;
    }

    this.printDebug('Fading out');

    this._isHiding = true;

    if (this.isFadingIn())
    {
        // フェードイン中は同じ不透明度からフェードアウトする
        this._duration = this._initialDisplayDuration - this._duration;
    }
    else
    {
        this._duration = Params.fadeFrameCount;
    }
};

Window_MapActiveMessage.prototype.numVisibleRows = function()
{
    return 4;
};

/**
 * 吹き出しスプライトの設定
 */
Window_MapActiveMessage.prototype.setBalloonSprite = function(sprite)
{
    sprite.setOwner(this);
    this._balloonSprite = sprite;

    // ウィンドウの裏に表示
    this.addChildAt(sprite, 0);
};

/**
 * イベントに対する吹き出しの表示位置を取得
 */
Window_MapActiveMessage.prototype.getBalloonPosition = function()
{
    return this._balloonPosition;
};

/**
 * メッセージ表示中か
 */
Window_MapActiveMessage.prototype.isDisplaying = function()
{
    return this._duration > 0;
};

/**
 * メッセージ ID を取得
 */
Window_MapActiveMessage.prototype.getId = function()
{
    return this._message.id;
};

/**
 * ループ表示するか
 */
Window_MapActiveMessage.prototype.needsLoop = function()
{
    return this._message.needsLoop;
};

/**
 * 強制表示されたか
 */
Window_MapActiveMessage.prototype.isForced = function()
{
    return this._message.isForced;
};

/**
 * フェードイン中か
 */
Window_MapActiveMessage.prototype.isFadingIn = function()
{
    return this._duration >= this._initialDisplayDuration - Params.fadeFrameCount;
};

/**
 * フェードアウト中か
 */
Window_MapActiveMessage.prototype.isFadingOut = function()
{
    return this._duration < Params.fadeFrameCount;
};

/**
 * 消去されているか
 */
Window_MapActiveMessage.prototype.isHiding = function ()
{
    return this._isHiding;
};

/**
 * 表示中のイベントと同一イベントか
 */
Window_MapActiveMessage.prototype.isSameEvent = function(event)
{
    if (isNullOrUndefined(this._event))
    {
        return false;
    }

    // ページ番号まで同じ場合に同一と見なす
    if (this._event.eventId() === event.eventId() &&
        this._targetPageIndex === event.pageIndex())
    {
        return true;
    }

    return false;
};

/**
 * イベントが画面内にあるか判定
 */
Window_MapActiveMessage.prototype.isEventInScreen = function()
{
    if (isNullOrUndefined(this._event))
    {
        return false;
    }

    var x = this._event.screenX();
    var y = this._event.screenY();
    return x >= 0 && y >= 0 && x <= Graphics.boxWidth && y <= Graphics.boxHeight;
};

/**
 * メッセージの表示開始
 * 
 * @param {String}              message     表示するメッセージ
 * @param {Sprite_Character}    sprite      表示対象のキャラクタースプライト
 */
Window_MapActiveMessage.prototype.display = function(message, sprite)
{
    if (isNullOrUndefined(message))
    {
        throw "'message' must not be null or undefined.";
    }

    // 表示のキャンセル
    function rollback()
    {
        this.initMembers();
        this.hide();
    }

    if (message.messages.length <= 0 || isNullOrUndefined(message.event))
    {
        rollback.call(this);
        return;
    }

    this._message = message;
    this._event = message.event;
    this._characterSprite = sprite;

    if (!this.isEventInScreen())
    {
        rollback.call(this);
        return;
    }

    this._targetPageIndex = this._event.pageIndex();

    this.initializeMessage();
    this.show();

    this.printDebug('Display new message for event ' + this._event.eventId() + '.');

    // 多重表示抑止のため、表示済みフラグを立てる
    this._event.setMapActiveMessageShown(true);
};

/**
 * メッセージの初期化
 */
Window_MapActiveMessage.prototype.initializeMessage = function ()
{
    this._pendingMessages = this._message.messages.slice();

    this.displayNextMessage();
};

/**
 * 次のメッセージを表示
 */
Window_MapActiveMessage.prototype.displayNextMessage = function()
{
    var message = this._pendingMessages.shift();
    if (isNullOrUndefined(message))
    {
        return false;
    }

    this._textState =
    {
        index: 0,
        text:  this.convertEscapeCharacters(message.text)
    };
    this._allTextWidth           = 0;
    this._initialDisplayDuration = message.duration;
    this._duration               = this._initialDisplayDuration;

    this.newPage(this._textState);
    this.updatePosition();
    this.updateOpacity();
    this.refreshBalloon();

    return true;
};

/**
 * 新しいページの表示
 */
Window_MapActiveMessage.prototype.newPage = function(textState)
{
    // コンテンツを一時領域に書く
    this.contents = Window_MapActiveMessage.tempMessageBuffer;
    this.contents.clear();
    this.resetFontSettings();
    textState.x         = this.newLineX();
    textState.y         = 0;
    textState.left      = this.newLineX();
    textState.height    = this.calcTextHeight(textState, false);
    this._allTextHeight = this.calcTextHeight(textState, true);

    this.updateMessage();

    // コンテンツを一時領域から正式に反映
    this.createContents();
    this.contents.blt(
        Window_MapActiveMessage.tempMessageBuffer,
        0, 0, this._allTextWidth, this._allTextHeight,
        0, 0, this._allTextWidth, this._allTextHeight
    );
};

/**
 * メッセージの表示位置を設定
 */
Window_MapActiveMessage.prototype.updatePosition = function()
{
    if (isNullOrUndefined(this._event))
    {
        return;
    }

    // 画面外に出る場合は消去
    if (!this.isEventInScreen())
    {
        this.hide();
        return;
    }

    // 吹き出しの枠ぶんのマージン
    var margin = Const.balloonFrameInfo.size;

    var balloonOffsetY = Const.balloonVertexSize.height
        - Params.balloonOffsetY
        - margin;
    var heightOffset = this.height
        + (!isNullOrUndefined(this._characterSprite) ? this._characterSprite.patternHeight() : $gameMap.tileHeight());

    // デフォルトの位置は上
    var x = this._event.screenX() - this.width / 2;
    var y = this._event.screenY() - (heightOffset + balloonOffsetY);
    this._balloonPosition = Const.balloonPosition.above;

    // 画面左右にははみ出させない
    x = Math.min(Math.max(x, margin), Graphics.boxWidth - this.width - margin);

    // 画面上側にはみ出る場合は下に表示
    if (y < margin)
    {
        y = this._event.screenY() + balloonOffsetY;
        this._balloonPosition = Const.balloonPosition.below;
    }

    // 画面下側にはみ出る場合は上に表示
    if (y + this.height > Graphics.boxHeight - margin)
    {
        y -= heightOffset + balloonOffsetY;
        this._balloonPosition = Const.balloonPosition.above;
    }

    this.x = x;
    this.y = y;

    if (!isNullOrUndefined(this._balloonSprite))
    {
        // 吹き出しの頂点表示を考慮した位置に移動
        this._balloonSprite.followOwner();
    }
};

/**
 * ウィンドウのサイズを更新
 */
Window_MapActiveMessage.prototype.updateWindowSize = function()
{
    var offset = this.standardPadding() * 2;
    this.width  = this._allTextWidth  + offset;
    this.height = this._allTextHeight + offset;
};

/**
 * 不透明度の更新
 */
Window_MapActiveMessage.prototype.updateOpacity = function()
{
    var opacity = 255;
    if (this.isFadingIn())
    {
        // フェードイン
        opacity = 255 * (this._initialDisplayDuration - this._duration) / Params.fadeFrameCount;
    }
    else if (this.isFadingOut())
    {
        // フェードアウト
        opacity = 255 * this._duration / Params.fadeFrameCount;
    }

    this.contentsOpacity = opacity;
    if (!isNullOrUndefined(this._balloonSprite))
    {
        this._balloonSprite.opacity = opacity;
    }
};

/**
 * 吹き出しの再描画
 */
Window_MapActiveMessage.prototype.refreshBalloon = function()
{
    if (!isNullOrUndefined(this._balloonSprite))
    {
        this._balloonSprite.refresh();
    }
};

/**
 * プレイヤーと距離が離れていたら消去する
 *
 * @return {Boolean} true if hidden
 */
Window_MapActiveMessage.prototype.hideFarMessage = function()
{
    // 表示範囲外に出た場合は消す
    var distance = $gamePlayer.calcDistanceForMapActiveMessage(this._event);
    if (distance > this._event.getMapActiveMessageRange())
    {
        this.fadeOut();
        return true;
    }

    return false;
};

/**
 * プレイヤーとの距離を確認
 */
Window_MapActiveMessage.prototype.checkPlayerDistance = function()
{
    // 強制表示 or 消去中は距離判定しない
    if (this.isForced() ||
        this._duration <= Params.fadeFrameCount)
    {
        return;
    }

    this.hideFarMessage();
};

Window_MapActiveMessage.prototype.update = function()
{
    Window_Base.prototype.update.call(this);

    if (!isNullOrUndefined(this._balloonSprite))
    {
        this._balloonSprite.update();
    }

    if (!this.isDisplaying())
    {
        return;
    }

    this._duration--;
    this.updateOpacity();
    this.updatePosition();
    this.checkPlayerDistance();

    if (!this.isDisplaying())
    {
        if (this.displayNextMessage())
        {
            this.printDebug('Display next message.');
        }
        else if (this.needsLoop() && !this.isHiding())
        {
            // 距離が離れていたらループしない
            if (!this.hideFarMessage())
            {
                this.printDebug('Loop message.');
                this.initializeMessage();
            }
        }
        else
        {
            // 表示が終了したら初期化
            this.printDebug('Finished to display.');
            this.initMembers();
        }
    }
};

/**
 * メッセージの更新
 */
Window_MapActiveMessage.prototype.updateMessage = function()
{
    if (isNullOrUndefined(this._textState))
    {
        return false;
    }

    while (!this.isEndOfText(this._textState))
    {
        this.processCharacter(this._textState);
        this._allTextWidth = Math.max(this._allTextWidth, this._textState.x);
    }

    this.updateWindowSize();

    return true;
};

/**
 * 吹き出しの頂点位置を取得
 */
Window_MapActiveMessage.prototype.getBalloonVertexX = function()
{
    if (isNullOrUndefined(this._event))
    {
        return 0;
    }

    return this._event.screenX()
        - this.x
        - Const.balloonFrameInfo.size
        - Const.balloonVertexSize.width / 2
        + Params.balloonMargin;
};

/**
 * 改行時の描画先 X 座標
 */
Window_MapActiveMessage.prototype.newLineX = function()
{
    return 0;
};

/**
 * 改行の処理
 */
Window_MapActiveMessage.prototype.processNewLine = function(textState)
{
    this._allTextWidth = Math.max(this._allTextWidth, textState.x);

    Window_Base.prototype.processNewLine.call(this, textState);
};

/**
 * 改ページの処理
 */
Window_MapActiveMessage.prototype.processNewPage = function(textState)
{
    Window_Base.prototype.processNewPage.call(this, textState);
    if (textState.text[textState.index] === '\n')
    {
        textState.index++;
    }

    textState.y = this.contents.height;
};

/**
 * テキスト終端か
 */
Window_MapActiveMessage.prototype.isEndOfText = function(textState)
{
    return textState.index >= textState.text.length;
};

/**
 * 改ページが必要か
 */
Window_MapActiveMessage.prototype.needsNewPage = function(textState)
{
    return !this.isEndOfText(textState) &&
            textState.y + textState.height > this.contents.height;
};


//-----------------------------------------------------------------------------
// Scene_Map

var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows = function()
{
    _Scene_Map_createAllWindows.call(this);

    this.createActiveMessageWindow();
};

/**
 * アクティブメッセージウィンドウの作成
 */
Scene_Map.prototype.createActiveMessageWindow = function()
{
    if (!isNullOrUndefined(this._activeMessageWindowLayer))
    {
        return;
    }

    var width  = Graphics.boxWidth;
    var height = Graphics.boxHeight;
    var x = (Graphics.width  - width)  / 2;
    var y = (Graphics.height - height) / 2;
    this._activeMessageWindowLayer = new WindowLayer();
    this._activeMessageWindowLayer.move(x, y, width, height);
    this.addChild(this._activeMessageWindowLayer);

    Window_MapActiveMessage.preloadWindowskin();
};

var _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function()
{
    _Scene_Map_update.call(this);

    this.updateActiveMessageDisplay();
};

var _Scene_Map_stop = Scene_Map.prototype.stop;
Scene_Map.prototype.stop = function()
{
    _Scene_Map_stop.call(this);

    $gameTemp.clearMapActiveMessage();
};

var _Scene_Map_terminate = Scene_Map.prototype.terminate;
Scene_Map.prototype.terminate = function()
{
    _Scene_Map_terminate.call(this);

    this.destroyActiveMessageWindows();
};

/**
 * アクティブメッセージウィンドウの破棄
 */
Scene_Map.prototype.destroyActiveMessageWindows = function()
{
    this._activeMessageWindowLayer.removeChildren();
    this.removeChild(this._activeMessageWindowLayer);
    this._activeMessageWindowLayer = null;
};

/**
 * アクティブメッセージの表示を更新
 */
Scene_Map.prototype.updateActiveMessageDisplay = function()
{
    if (!$gameSystem.isMapActiveMessageEnabled() ||
        $gameMap.isEventRunning())
    {
        // メッセージを表示できないときは非表示にしつつ各種フラグを解除
        $gameTemp.clearMapActiveMessage();
        $gameMap.clearActiveMessageShownFlags();
        this._activeMessageWindowLayer.children.forEach(function(child)
        {
            child.fadeOut();
        });
        return;
    }

    // 表示が完了したものを削除
    this._activeMessageWindowLayer.children.filter(function(child)
    {
        return !child.isDisplaying();
    }).forEach(function(item)
    {
        this._activeMessageWindowLayer.removeChild(item);
    }, this);

    // 要求されているメッセージを表示できるだけ表示
    while ($gameTemp.isMapActiveMessageReady())
    {
        if (!this.displayActiveMessage())
        {
            break;
        }
    }
};

/**
 * 指定されたイベントのアクティブメッセージが表示されているか判定
 */
Scene_Map.prototype.isActiveMessageDisplayed = function(event)
{
    var layer = this._activeMessageWindowLayer;
    for (var i = 0; i < layer.children.length; i++)
    {
        var window = layer.children[i];
        if (window.isDisplaying() && window.isSameEvent(event))
        {
            return true;
        }
    }

    return false;
};

/**
 * アクティブメッセージの表示
 */
Scene_Map.prototype.displayActiveMessage = function()
{
    var layer = this._activeMessageWindowLayer;

    // 最大数に達していたら表示を諦める
    // (children には吹き出しも含まれるので / 2)
    if (layer.children.length / 2 >= Params.messageCountMax)
    {
        return false;
    }

    // 予約されているメッセージを表示
    var message = $gameTemp.popNextMapActiveMessage();
    while (!isNullOrUndefined(message))
    {
        // まだ表示していないもののみ表示
        if (!this.isActiveMessageDisplayed(message.event))
        {
            var character = this._spriteset.findCharacterSpriteByEvent(message.event);
            var balloon   = new Sprite_MapActiveMessageBalloon();
            var window    = new Window_MapActiveMessage();
            window.setBalloonSprite(balloon);
            window.display(message, character);
            layer.addChild(window);
        }

        message = $gameTemp.popNextMapActiveMessage();
    }

    return true;
};

var _Scene_Map_snapForBattleBackground = Scene_Map.prototype.snapForBattleBackground;
Scene_Map.prototype.snapForBattleBackground = function()
{
    // アクティブメッセージはキャプチャしない
    var layer = this._activeMessageWindowLayer;
    if (!isNullOrUndefined(layer))
    {
        layer.visible = false;
    }

    _Scene_Map_snapForBattleBackground.call(this);

    if (!isNullOrUndefined(layer))
    {
        layer.visible = true;
    }
};

})();

