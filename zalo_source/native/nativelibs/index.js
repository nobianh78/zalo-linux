const path = require('path');
const isLinux = process.platform === 'linux';
const mocksPath = path.resolve(__dirname, '../../linux_compat/mocks');

var instance = module.exports = {
    fileUtils: () => {
        if (isLinux) return require(path.join(mocksPath, 'file-utils.js'));
        return require('./file-utils/index.js');
    },
    winUtils : () => {
        if (isLinux) return require(path.join(mocksPath, 'win-utils.js'));
        return require('./win-utils/index.js');
    },
    zcall : () => {
        return require('./zcall/index.js');
    },
    sqlite3 : () => {
        return require('./sqlite3/index.js');
    },
    dbUtils : () => {
        if (isLinux) return require(path.join(mocksPath, 'db-cross-v4.js'));
        return require('./db-cross-v4/dist/binding.js');
    },
    v8Profiles : () => {
        if (isLinux) return require(path.join(mocksPath, 'v8-profiles.js'));
        return require('./v8-profiles/index.js');
    },
    zimage: (options) => {
        if (isLinux) return require(path.join(mocksPath, 'zimage.js'))(options);
        return require('./zimage/index.js')(options);
    },
    zaloLogger: () => {
        return require('./logger/index.js');
    },
    zjxl: () => {
        if (isLinux) return require(path.join(mocksPath, 'zjxl.js'));
        return require('./zjxl/index.js');
    },
    zwalker: () => {
        if (isLinux) return require(path.join(mocksPath, 'zwalker.js'));
        return require('./zwalker/index.js');
    },
    zocr: () => {
        if (isLinux) return require(path.join(mocksPath, 'zocr.js'));
        return require('./zocr/zocr.min.js');
    },
    zfile: () => {
        if (isLinux) return require(path.join(mocksPath, 'zfile.js'));
        return require('./zfile/index.js');
    },
    fileUtilities: () => {
        if (isLinux) return require(path.join(mocksPath, 'file-utilities.js'));
        try {
            return require('./file-utilities/index.js');
        } catch (error) {
            return {};
        }
    },
    mp4thumb: () => {
        if (isLinux) return require(path.join(mocksPath, 'mp4thumb.js'));
        return require('./mp4thumb/index.js');
    }
}
//////////////////////////////
function test(){
	//if(instance.officeThumbnail().generate_preview.constructor === Function){
		//console.log('office-thumbnail OK');
	//}
	//instance.zcall().test();
	instance.zimage().then(console.error).catch(console.error);
}
// test();

