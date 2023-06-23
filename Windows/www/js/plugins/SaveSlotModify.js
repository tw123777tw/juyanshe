/*:
 * @plugindesc 更改游戏存档槽位数量
 * @author Shiroko
 *
 * @param 存档数量
 * @desc 存档数量（默认20）
 * @default 20
 *
 */
(() => {
    let parameters = PluginManager.parameters('SaveSlotModify');
    let saveSlotCount = eval(parameters['存档数量']);
    DataManager.maxSavefiles = function () {
        return saveSlotCount;
    }
})();