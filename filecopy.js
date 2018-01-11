"use strict";
// 这个是发布版本使用的工具 目标是制作发布需要的版本文件，然后完成打包和md5生成
var fs_1 = require("fs");
var path_1 = require("path");
var failedSrcDst = [];
function dirNameExcept(name) {
    if (name == '.' || name == '..' || name.indexOf('.') == 0) {
        return true;
    }
    return false;
}
/**
 * 检查文件夹,不存在则自动创建一个文件夹
 * mode: 文件夹的权限 默认 0o777
 */
function mkdirsSync(path, mode) {
    if (!fs_1.existsSync(path)) {
        var pathtmp;
        var dirs = path.split(path_1.sep);
        for (var i = 0; i < dirs.length; i++) {
            var dirname = dirs[i];
            if (pathtmp) {
                pathtmp = path_1.join(pathtmp, dirname);
            }
            else {
                pathtmp = dirname;
            }
            if (!fs_1.existsSync(pathtmp)) {
                if (!fs_1.mkdirSync(pathtmp, mode)) {
                    return false;
                }
            }
        }
    }
    return true;
}
/**
 * 文件拷贝
 */
function copyFile(src, dst) {
    // 先要确认一下文件夹是否存在
    var parsedPath = path_1.parse(dst);
    mkdirsSync(parsedPath.dir);
    try {
        fs_1.writeFileSync(dst, fs_1.readFileSync(src));
//        console.log('Copy File ' + dst);
    }
    catch (e) {
        failedSrcDst.push({ src: src, dst: dst });
    }
    return true;
}
/**
 * 拷贝一个文件夹
 * recursion: 是否拷贝子文件夹
 */
function copyPath(src, dst, recursion) {
    // 是否递归下级文件夹 默认不递归
    var files = fs_1.readdirSync(src);
    for (var key in files) {
        var fileName = files[key];
        if (dirNameExcept(fileName)) {
            continue;
        }
        var state = fs_1.lstatSync(path_1.join(src, fileName));
        if (state.isDirectory()) {
            if (recursion) {
                copyPath(path_1.join(src, fileName), path_1.join(dst, fileName), true);
            }
        }
        else {
            copyFile(path_1.join(src, fileName), path_1.join(dst, fileName));
        }
    }
    return true;
}
/**
 * 删除一个文件
 */
function deleteFile(path) {
    if (fs_1.existsSync(path)) {
        fs_1.unlinkSync(path);
    }
    return true;
}
/**
 * 删除一个文件夹
 */
function deletePath(path) {
    // 删除的时候需要递归操作
    if (!fs_1.existsSync(path)) {
        return true;
    }
    var files = fs_1.readdirSync(path);
    for (var key in files) {
        var name = files[key];
        if (dirNameExcept(name)) {
            continue;
        }
        var filePath = path_1.join(path, name);
        var stats = fs_1.lstatSync(filePath);
        if (stats.isDirectory()) {
            deletePath(filePath);
        }
        else {
            deleteFile(filePath);
        }
    }
    fs_1.rmdirSync(path);
    return true;
}
/**
 * 删除指定后缀的文件
 * path: 起始路径
 * ext: 后缀名称
 * recursion: 是否检查子文件夹
 */
function deleteExt(path, ext, recursion) {
    var files = fs_1.readdirSync(path);
    for (var key in files) {
        var name = files[key];
        if (dirNameExcept(name)) {
            continue;
        }
        var filePath = path_1.join(path, name);
        var stats = fs_1.lstatSync(filePath);
        if (stats.isDirectory()) {
            if (recursion) {
                deleteExt(filePath, ext, true);
            }
        }
        else {
            var parsedPath = path_1.parse(filePath);
            if (ext instanceof Array) {
                if (ext.indexOf(parsedPath.ext) >= 0) {
                    deleteFile(filePath);
                }
            }
            else {
                if (ext == parsedPath.ext) {
                    deleteFile(filePath);
                }
            }
        }
    }
    return true;
}

function SLGPackage(src, dst, bnodel) {
    bnodel = bnodel || false;
    src = path_1.join(src, '/');
    dst = path_1.join(dst, '/');
    if (!bnodel) {
        deletePath(dst);
    }

    failedSrcDst = [];
    // 需要操作的是
    copyPath(src, dst, true);
    var files = [];
    files = files.concat(failedSrcDst);
    failedSrcDst = [];
    if (files.length != 0) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            copyFile(file.src, file.dst);
        }
    }
    deleteExt(dst, ['.xlsx', '.exe', '.md', '.def', '.map', '.bat', '.ts'], true);
    deleteExt(src, ['.json', '.exe', '.md', '.def', '.map', '.bat'], true);

    return failedSrcDst.length;
}

module.exports = SLGPackage;
