var xlsx = require('./lib/node-xlsx');
var fs = require('fs');
var saveStr = '';
var table2cc = require('./table2cc');
var pingyin = require('./lib/pinyin');
var kTePingYin = new pingyin();
var localTsObj = {};

function writeToStr(fd, str) {
    saveStr = saveStr + str;
}

var exceptList = ['Guide'];

// 解析数组 在 [] <> 批注存在的时候不解析这两种
function parseVector(fileName, value, _valueNum, bVectot) {
    bVectot = bVectot || false;
    var out = value;
    if (typeof value === 'string') {
        value = value.replace(/(&#10;)/g, '\r\n');
        if (value.search(/[\r\n]/g) >= 0) {
            out = [];
            value = value.split('\r\n');
            for (var keyline in value) {
                if (!value.hasOwnProperty(keyline)) {
                    continue;
                }
                var newLines = value[keyline].split('#');
                if (newLines.length < 2 || exceptList.indexOf(fileName) >= 0) {
                    out.push(newLines[0]);
                }
                else {
                    out[parseInt(newLines[0])] = newLines[1] || '';
                    //  out.push();
                }

            }
        }
        else {
            out = value;
        }
    }

    if (!out && out != 0) {
        out = value;
    }

    if (bVectot && !(out instanceof Array)) {
        if (typeof out == 'string') {
            var newLines = out.split('#');
            out = [];
            if (newLines.length < 2 || exceptList.indexOf(keyline) >= 0) {
                out.push(newLines[0]);
            }
            else {
                out[parseInt(newLines[0])] = newLines[1] || '';
            }
        }
        else {
            out = [out];
        }
    }

    return out;
}

function parseVectorNumber(value, _valueNum, bVectot) {
    bVectot = bVectot || false;
    var out = value;
    if (_valueNum) {
        value = out;
        if (value instanceof Array) {
            out = [];
            for (var a = 0; a < value.length; a++) {
                out.push(parseFloat(value[a]));
            }
        }
        else {
            out = parseFloat(value);
        }
    }

    return out;
}

function parseType(keyType, pos, out) {
    pos = pos || 0;
    out = out || { _type: 0, _valueNum: false, _valueVector: false };
    switch (keyType[pos]) {
        case 'a':
            out._valueVector = true;
            out = parseType(keyType, pos + 1, out);
            break;
        case 'i':
        case 'I':
        case 'e':
        case 'E':
            out._valueNum = true;
            break;
    }
    return out;
}

// 解析批注信息
function parseComment(keyValue, comment) {
    var R, out;
    out = parseType(keyValue);
    if (!comment || keyValue.length <= 0) {
        return out;
    }

    // 得到的批注中有好多 &#10的表示换行的内容，这里要处理一下
    comment = comment.replace(/(&#10;)/g, '\r\n');
    var vc = comment.split('\r\n');
    var enums = {};
    for (R = 0; R < vc.length; R++) {
        var Data = vc[R];
        var comPos = Data.search('\/\/');
        if (comPos >= 0) {
            Data = Data.substr(0, comPos);
        }

        if (out._type <= 0) {
            if (Data.search(/(\[*])/g) >= 0) {
                out._type = 1;      // 表示是值替换的类型
                out._valueNum = true;
            }
            else if (Data.search(/(<*>)/g) >= 0) {
                out._type = 2;      // 表示是值替换后2进制运算
                out._valueNum = true;
            }
        }

        if (out._type > 0) {
            var vD = Data.replace(/[\[\]<>]/g, '').split(':');
            if (vD.length > 1) {
                if (out._type == 2) {
                    enums[kTePingYin.getFullChars(vD[0])] = 1 << parseInt(vD[1]);
                }
                else {
                    enums[kTePingYin.getFullChars(vD[0])] = vD[1];
                }

                out[vD[0]] = vD[1];
            }
        }
    }

    out['enums'] = enums;

    return out;
}

function replaceCommentValue(comment, value) {
    var outValue = value;
    // 先按照设置的把值替换一遍
    if (comment._type == 2) {
        // 得到的值需要二进制位移一遍
        var vc = value.split('|');
        outValue = 0;
        for (var key = 0; key < vc.length; key++) {
            var BitValue = vc[key];
            BitValue = comment[BitValue] || BitValue;
            if (BitValue.length > 0 && BitValue != '-') {
                if (isNaN(parseInt(BitValue))) {
                    BitValue = replaceCommentValue(comment, BitValue);
                    outValue |= BitValue;
                }
                else {
                    outValue |= 1 << parseInt(BitValue);
                }
            }
        }
    }
    else if (comment._type == 1) {
        // 这里要处理一下 冒号 表示的是注释文件
        var comPos = value.search('：');
        if (comPos >= 0) {
            value = value.substr(0, comPos);
        }
        else {
            comPos = value.search(':');
            if (comPos >= 0) {
                value = value.substr(0, comPos);
            }
            else {
                comPos = value.search('\/\/');
                if (comPos >= 0) {
                    value = value.substr(0, comPos);
                }
            }
        }



        outValue = comment[value] || value;
    }

    if (comment._valueNum) {
        if (isNaN(parseFloat(outValue))) {
            if (outValue != '') {
                outValue = 0;
            }
            else {
                outValue = outValue;
            }
        }
        else {
            outValue = parseFloat(outValue)
        }
    }
    return outValue;
}

// 把 value 数据按照批注的格式转换一下
function parseValue(comment, value, fileName) {
    if (!value) {
        if (comment._valueVector) {
            return [];
        }
        else if(comment._valueNum){
            return 0;
        }
        return '';
    }
    if (!comment) {
        return parseVector(fileName, value);
    }
    else if (!comment._type || comment._type == 0) {
        value = parseVector(fileName, value, comment._valueNum, comment._valueVector);
        return parseVectorNumber(value, comment._valueNum, comment._valueVector);
    }

    value = parseVector(fileName, value, comment._valueNum, comment._valueVector);

    if (value instanceof Array) {
        var vc = [];
        for (var key in value) {
            vc.push(replaceCommentValue(comment, value[key]));
        }
        value = vc;
    }
    else {
        value = replaceCommentValue(comment, value);
        if (comment._valueVector) {
            value = [value];
        }
    }

    value = parseVectorNumber(value, comment._valueNum, comment._valueVector);

    return value;
}

// 判断文件是否指定的类型
function is_filetype(filename, types) {
    if (!types) {
        return true;
    }
    types = types.split(',');
    var pattern = '\.(';
    for (var i = 0; i < types.length; i++) {
        if (0 != i) {
            pattern += '|';
        }
        pattern += types[i].trim();
    }
    pattern += ')$';
    return new RegExp(pattern, 'i').test(filename);
}

// 删除文件的指定后缀
function del_filetype(filename, types) {
    if (!types) {
        return filename;
    }
    types = types.split(',');
    var pattern = '\.(';
    for (var i = 0; i < types.length; i++) {
        if (0 != i) {
            pattern += '|';
        }
        pattern += types[i].trim();
    }
    pattern += ')$';

    return filename.replace(new RegExp(pattern, 'i'), '');
}

function ListFilesSync(pathdir, postfix) {
    var path_1 = require('path');

    var filelists = [];
    var files = fs.readdirSync(pathdir);
    for (var num = 0; num < files.length; num++) {
        var file = path_1.join(pathdir, files[num]);
        var stat = fs.lstatSync(file);
        if (stat.isDirectory()) {
            var newFiles = ListFilesSync(file, postfix);
            filelists = filelists.concat(newFiles);
        }
        else if (is_filetype(file, postfix)) {
            var newname = del_filetype(file, postfix);
            filelists.push(newname);
        }
    }
    return filelists;
}

function convertxlsxSync(filepath) {
    var postfix = 'xlsx';
    if (is_filetype(filepath, postfix)) {
        filepath = del_filetype(filepath, postfix)
        var obj = { 'name': filepath, 'obj': xlsxParse(filepath) };
        ListSaveJsonSync([obj]);
        return true;
    }
    return false;
}

function findxlsxSync(filepath) {

    var files = ListFilesSync(filepath, "xlsx");

    var ListObj = [];
    for (var num = 0; num < files.length; num++) {
        var filename = files[num];
        if (filename.indexOf('$') >= 0) {
            continue;
        }

        if (filename == '.' || filename == '..') {
            continue;
        }

        ListObj.push({ 'name': filename, 'obj': xlsxParse(filename) });
    }

    ListSaveJsonSync(ListObj);
}

function ListSaveJsonSync(listObj) {
    for (var i = 0; i < listObj.length; i++) {
        var obj = listObj[i];
        if (obj) {
            jsonToFile(obj.obj, obj.name + '.json');
        }
    }
}

function xlsxParse(xlsxfile) {
    var path_1 = require('path');
    var obj = xlsx.parseandcomment(xlsxfile + ".xlsx"); // parses a file
    var fileDetail = path_1.parse(xlsxfile + ".xlsx");
    // 解析出的xlsx中是包含所有标签的，这里暂时只使用第一个标签就可以了
    var keyLine = [], keyComment = [], R, C, out = {};
    if (!obj || obj.length == 0) {
        return out;
    }

    var xlsxObj = obj[0];
    if (!xlsxObj.data || xlsxObj.data.length == 0) {
        return out;
    }

    keyLine = xlsxObj.data[0];
    if (!xlsxObj.comment || xlsxObj.comment.length == 0) {
        return out;
    }

    localTsObj[fileDetail.name] = { Template: {}, enums: {} };

    for (var kcNum = 0; kcNum < keyLine.length; kcNum++) {
        keyComment[kcNum] = parseComment(keyLine[kcNum], xlsxObj.comment[0][kcNum]);
        if (keyComment[kcNum].enums) {
            localTsObj[fileDetail.name].enums[keyLine[kcNum]] = keyComment[kcNum].enums;
        }
    }

    var dataHead = xlsxObj.data[0];

    for (C = 0; C < dataHead.length; C++) {
        var ots = localTsObj[fileDetail.name].Template;

        if (keyComment[C]._valueVector) {
            if (keyComment[C]._valueNum) {
                ots[dataHead[C]] = 'Array\<number\>';
            }
            else {
                ots[dataHead[C]] = 'Array\<string\>';
            }
        }
        else {
            if (keyComment[C]._valueNum) {
                ots[dataHead[C]] = 'number';
            }
            else {
                ots[dataHead[C]] = 'string';
            }
        }
    }

    for (R = 1; R < xlsxObj.data.length; R++) {
        var vData = xlsxObj.data[R];
        if (!vData) {
            continue;
        }
        var ID;
        for (C = 0; C < vData.length; C++) {
            if (C === 0) {
                // 第一个值代表的是typeID
                ID = vData[C];
                out[ID] = {};
            }
            var ot = out[ID];
            var key = keyLine[C];
            ot[key] = parseValue(keyComment[C], vData[C], fileDetail);
            console.log(xlsxfile + '-R:' + R + '-C:' + C);
        }
    }
    return out;
}

function objToStr(obj) {
    if (!obj && obj != 0) {
        return '""';
    }

    var type = typeof obj;

    if (type == 'number') {
        return obj.toString();
    }
    else {
        return '"' + obj.toString() + '"';
    }
}

function jsonObjWrite(fd, key, jsonObj, space) {
    // if (key == "Template") {
    //     return;
    // }

    if (!space) {
        space = '';
    }

    if (typeof jsonObj !== 'object') {
        if (key) {
            writeToStr(fd, space + '"' + key + '":' + objToStr(jsonObj) + ',');
        }
        else {
            writeToStr(fd, space + objToStr(jsonObj) + ',');
        }

        return;
    }

    if (jsonObj instanceof Array) {
        if (key) {
            writeToStr(fd, space + '"' + key + '":[');
        }
        else {
            writeToStr(fd, space + '[');
        }
    }
    else {
        if (key) {
            writeToStr(fd, space + '"' + key + '":{');
        }
        else {
            writeToStr(fd, space + '{');
        }
    }

    var a, newspace;
    if (jsonObj instanceof Array) {
        // 先检查一下数据的类型，是字符串还是数字
        var bNumber = false;
        for (var key in jsonObj) {
            if (!jsonObj[key]) {
                continue;
            }

            if (typeof jsonObj[key] == 'number') bNumber = true;
            break;
        }

        for (var a = 0; a < jsonObj.length; a++) {
            newspace = space;// + '    ';
            var v = jsonObj[a] || (bNumber ? 0 : '');
            jsonObjWrite(fd, undefined, v, newspace);

        }
    }
    else {
        for (a in jsonObj) {
            newspace = space;// + '    ';
            if (jsonObj.hasOwnProperty(a)) {
                jsonObjWrite(fd, a, jsonObj[a], newspace);
            }
        }
    }

    if (jsonObj instanceof Array) {
        writeToStr(fd, space + '],');
    }
    else {
        writeToStr(fd, space + '},');
    }
}

function jsonToFile(jsonObj, filename) {
    var fd = fs.openSync(filename, 'w');
    if (fd) {
        saveStr = "";
        jsonObjWrite(fd, undefined, jsonObj);
        saveStr = saveStr.replace(/(,])/g, ']');
        saveStr = saveStr.replace(/(,})/g, '}');
        saveStr = saveStr.substr(0, saveStr.length - 1);
        fs.writeSync(fd, saveStr);
        saveStr = "";
        fs.closeSync(fd);
    }
    else {
        fs.writeFileSync(filename + '.err', "openfaild");
    }
}

// 对象例子的比较，看看是不是相同的结构体
function TempleteCmp(left, right) {
    for (var key in left) {
        if (!right.hasOwnProperty(key)) {
            return false;
        }
    }

    for (var key in right) {
        if (!left.hasOwnProperty(key)) {
            return false;
        }
    }

    return true;
}

function AddEnums(file, tempJson, allTemp) {
    // var has = false;
    // for (var temp in allTemp) {
    //     if ( && TempleteCmp(allTemp[temp], tempJson)) {
    //         has = true;
    //         break;
    //     }
    // }

    // if (!has) {
        allTemp[file] = tempJson;
    // }
}

function AddTemplete(file, tempJson, allTemp) {
    // var has = false;
    // for (var temp in allTemp) {
    //     if (TempleteCmp(allTemp[temp], tempJson)) {
    //         has = true;
    //         break;
    //     }
    // }

    // if (!has) {
        allTemp[file] = tempJson;
    // }
}

function structToTSStr(structName, structData) {

    var typescriptStr = '';

    typescriptStr += 'interface ' + structName + '{ \r\n';

    for (var key in structData) {
        typescriptStr += '      ' + key + '?:' + structData[key] + ';\r\n';
    }

    typescriptStr += '}\r\n\r\n\r\n';

    return typescriptStr;
}

function enumToTSStr(structName, enumData) {
    var typescriptStr = '';

    typescriptStr += 'declare enum ' + structName + '{ \r\n';

    for (var key in enumData) {
        typescriptStr += '      ' + key + '=' + enumData[key] + ',\r\n';
    }

    typescriptStr += '}\r\n\r\n\r\n';

    return typescriptStr;
}

function enumToJSStr(structName, enumData) {
    var typescriptStr = '';
    typescriptStr += 'var ' + structName + ';\r\n';
    typescriptStr += ' (function (' + structName + ') {\r\n';
    for (var key in enumData) {
        typescriptStr += '      ' + structName + '[' + structName + '["' + key + '"]=' + enumData[key] + ']=["' + key + '"];\r\n';
    }
    typescriptStr += '})(' + structName + ' || (' + structName + ' = {}));\r\n\r\n\r\n';

    return typescriptStr;
}

function mkdirsSync(dirpath, mode) {
    var fs = require('fs');
    var path = require('path');
    if (!fs.existsSync(dirpath)) {
        var pathtmp;
        var dirs = dirpath.split(path.sep);
        for (var i = 0; i < dirs.length; i++) {
            var dirname = dirs[i];
            if (pathtmp) {
                pathtmp = path.join(pathtmp, dirname);
            }
            else {
                pathtmp = dirname;
            }
            if (!fs.existsSync(pathtmp)) {
                if (!fs.mkdirSync(pathtmp, mode)) {
                    return false;
                }
            }
        }
    }
    return true;
}

// 找到每个目录下的json数据的结构体


function findFileJsonStruct2(filePath, postfix, toCC) {
    toCC = toCC || false;
    var allTemplete = {};
    var allEnum = {};

    var hasJson = false;

    for (var key in localTsObj) {
        var kObj = localTsObj[key];
        if (kObj.Template) {
            var tableOut = {};
            if (toCC) {
                table2cc.CreateTalbeRes(key, kObj.Template, tableOut);
                fs.writeFileSync(filePath + '/' + 'SeRes' + key + '.json.h', tableOut.h, { encoding: 'ascii' });
                fs.writeFileSync(filePath + '/' + 'SeRes' + key + '.json.cc', tableOut.cc, { encoding: 'ascii' });
            }

            AddTemplete('SeRes' + key, kObj.Template, allTemplete);
            hasJson = true;
        }
        if (kObj.enums) {
            for (var key2 in kObj.enums) {
                AddEnums('SeEnum' + key + key2, kObj.enums[key2], allEnum);
            }
        }

    }

    if (hasJson) {
        var exportStr = 'export {';
        var typescriptStr = '';

        var typescriptjs = '';
        var exportWebJsStr = '';
        var exportNodeJsStr = '';


        var iIndex = 0;
        for (var key in allTemplete) {
            typescriptStr += structToTSStr(key, allTemplete[key]);
            if (iIndex) {
                exportStr += ',';
            }
            exportStr += key;
            iIndex++;
        }

        for (var key in allEnum) {
            typescriptStr += enumToTSStr(key, allEnum[key]);
            typescriptjs += enumToJSStr(key, allEnum[key]);

            if (iIndex) {
                exportStr += ',';
            }
            exportStr += key;

            exportNodeJsStr += '      exports.' + key + '=' + key + ';\r\n';
            exportWebJsStr += '      this.' + key + '=' + key + ';\r\n';

            iIndex++;
        }

        exportStr += '};';

        mkdirsSync(filePath, 329);// 0511

        fs.writeFileSync(filePath + '/interface.web.d.ts', typescriptStr);
        fs.writeFileSync(filePath + '/interface.d.ts', typescriptStr + exportStr);
        fs.writeFileSync(filePath + '/interface.js', typescriptjs + ' if (typeof exports !== "undefined") {\r\n' + exportNodeJsStr + '\r\n } else {\r\n' + exportWebJsStr + '\r\n}\r\n');
    }

    return;
}


function addOutFiles(lists, dst) {
    dst = dst || {};

    if (lists.length <= 0) {
        return dst;
    }
    var key = lists[0];
    if (lists.length > 1) {
        if (!dst.hasOwnProperty(key)) {
            dst[key] = {};
        }

        lists.splice(0, 1);
        addOutFiles(lists, dst[key]);
    }
    else {
        if (!dst.hasOwnProperty('_files_')) {
            dst['_files_'] = [];
        }
        dst['_files_'].push(key);
    }

    return dst;
}

function createFileConfigs(path, postfix) {
    var path_1 = require('path');
    path = path_1.join(path, '/');
    var allFiles = ListFilesSync(path, postfix);

    var outs = {};
    // 按照文件夹来生成信息
    for (var key in allFiles) {
        var rkPath = allFiles[key];
        rkPath = rkPath.replace(path, '');
        var lists = rkPath.split('\\');
        addOutFiles(lists, outs);
    }

    var fs_1 = require('fs');
    fs_1.writeFileSync(path_1.join(path, '_flielist_.json'), JSON.stringify(outs));
}

//findxlsx("D:\\");
module.exports.findxlsx = findxlsxSync;
module.exports.findTemplate = findFileJsonStruct2;
module.exports.convertxlsxSync = convertxlsxSync;
module.exports.filecopy = require('./filecopy.js');
module.exports.createFileConfigs = createFileConfigs;