var convert = require('./work.js');
var argv = process.argv.splice(2);
var srcPath = argv[0];
var dstPath = argv[1];

if(!srcPath || !dstPath){
	console.log('need srcPath dstPath');
}
else{
	if(convert){
		try{
			convert.findxlsx(srcPath);
			convert.findTemplate(srcPath);
			convert.filecopy(srcPath,dstPath);
		}
		catch(e){
			console.log(e.toString());
		}
	}
}

return 0;