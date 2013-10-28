/**
 * @fileOverview merger.js
 * @author sky
 * @version 0.9
 */
var BUILD_FILE	='build.qzmin';
var ROOT_DIR	=process.argv[2]||__dirname;
var JAR_ROOT	=process.argv[3]||__dirname;
var fs			=require('fs');
var path		=require('path');
var proc		=require("child_process");
var RELEASE_FILE=[];
var PROCESS_MANAGER = [];
var VERSION 	="0.90";
var MSG;

/**
 * 屏幕输出管理
 * @class Msg
 */
var Msg=function(){
	this.log=function(msg,type){
		type = type || 0;
		var pre = {0:'*',1:'!!!'}
		console.log(pre[type]+msg+"\r\n");
	};
	this.hello=function(dir){
		console.log("/*****开始监听目录:"+dir+"*****/\r\n");
	}
}

/**
 * @class Map 根据路径和对应的配置文件，生成监听map
 * @param {String} dir 路径
 * @param {Object} build 配置
 */
var Map=function(dir,build){
	
	var that = this;

	var _projects=build.projects,	//工程配置
		_path=dir+'/',				//根路径
		_mainMap={},				//{合并后的文件名:{include:JS文件数组,template:模版文件数组}}
		_fileMap={},				//{合并前的单个文件名:{target:合并后的文件名,time:最后更新时间,type:JS/模版}}
		_tmplMap={};				//{合并后的文件名:模版字符串}

		
	//根据工程配置初始化map
	this._init=function(){
		
		MSG.log('发现配置文件：'+path.normalize(_path+BUILD_FILE));
		
		//遍历工程
		_projects.forEach(function(item){		

			_mainMap[item.target]={};
			_mainMap[item.target].include=that.getFileList(item.include);
			_mainMap[item.target].template=that.getFileList(item.template);

			//一个文件可能在多个工程中被使用
			_mainMap[item.target].include.forEach(function(_item){
				_fileMap[_item]=_fileMap[_item]||{target:[],time:+fs.statSync(that.getRealPath(_item)).mtime,type:'js'};
				_fileMap[_item].target.push(item.target);
			});

			_mainMap[item.target].template.forEach(function(_item){
				_fileMap[_item]=_fileMap[_item]||{target:[],time:+fs.statSync(that.getRealPath(_item)).mtime,type:'tmpl'};
				_fileMap[_item].target.push(item.target);
				that.initTemp(_item,[item.target]);
			});

			RELEASE_FILE.push({
				compiler:that.getRealPath(item.compiler || item.target),
				publish:item.publish?that.getRealPath(item.publish):'',
				src:that.getRealPath(item.target)
			});
		})
		
		

		//初始化合并
		for(var p in _mainMap){
			this.merge(_mainMap[p].include[0],[p],'js',new Date());
		}
		
		this.listen();
		
	};
	this.getRealPath = function(p){
		return path.normalize(/\:|^\//.test(p)?p:_path+'/'+p);
	}
	//获取文件列表
	this.getFileList = function(fileList){
		var files = [];
		fileList && fileList.forEach(function(item){
			if(fs.existsSync(that.getRealPath(item))){
				if(fs.statSync(that.getRealPath(item)).isDirectory()){
					
					var items = fs.readdirSync(that.getRealPath(item));

					items.forEach(function(_item){

						if(/^\..+/.test(_item)){
							return
						}
						files.push(item+'/'+_item);
					})
				}
				else{
					files.push(item);
				}
			}
			else{
				MSG.log(that.getRealPath(item)+' does not exist',1);
			}
		});
		
		return files;
	}
	
	//定时监听_fileMap发现文件更新
	this.listen=function(){
		var tm = setInterval(function(){
			for(var p in _fileMap){
				//先检测文件是否存在
				if(fs.existsSync(that.getRealPath(p))){
					var mtime=+fs.statSync(that.getRealPath(p)).mtime;		
					mtime!=_fileMap[p].time&&function(){
							MSG.log('源文件有修改：'+path.normalize(that.getRealPath(p)));
							_fileMap[p].time=mtime;
							that.merge(p,_fileMap[p].target,_fileMap[p].type,mtime);
					}()
				}
				else{
					MSG.log(that.getRealPath(p)+' does not exist',1);
				}
			}
			
		},1000);
		PROCESS_MANAGER.push(tm);
	};
	//初始化模版变量
	this.initTemp=function(file,target){
		var _tmplStr=fs.readFileSync(that.getRealPath(file)),
			_pat=/<template[^>]*name=['"]([\w.]*?)['"][^>]*>([\s\S]*?)<\/template>/ig,
			_ret,
			_str;
		while(_ret=_pat.exec(_tmplStr)){
			_str=_ret[2].replace(/\'/g,"\\'").replace(/[\r\n\t]/g,'').replace(/\r\n/g,'');
			
			//模版对象存储在所对应的工程map下
			target.forEach(function(item){
				_tmplMap[item]=_tmplMap[item]||{};
				_tmplMap[item][_ret[1]]=_str;
			});
			
		}
	};
	
	//当有文件更新时进行合并操作
	this.merge=function(file,target,type,mtime){
		
		//由于模版采用正则匹配，性能较差，所以只有在模版文件发生变化时，才重新读取模版，更新_tmplMap，否则使用_tmplMap内容
		if(type=='tmpl'){
			this.initTemp(file,target);
		}
		
		var pool=[];
		
		target.forEach(function(item){
			//用于存储当前唯一文件名，防读写冲突
			//合并JS
			//应F总需求，这里做一个include为空的判断。
			//如果include为空，这把当前target的代码作为合并后的代码，来进行模版匹配
			//新增代码中模版标识为/*TPL.XX.YY*/somecode/**/的模式匹配
			var fileName=that.getRealPath(item),code;
			if(_mainMap[item].include.length){
				_mainMap[item].include.forEach(function(item){
				
					if(fs.existsSync(that.getRealPath(item))){
						pool.push(fs.readFileSync(that.getRealPath(item)));
					}
					else{
						MSG.log(_that.getRealPath(item)+' does not exist',1);
					}
				});
				
				codes=pool.join("\r\n");
			}
			else{
				codes = fs.readFileSync(fileName)+'';
			}

			var tmp = {},i=0;
			
			for(var p in _tmplMap[item]){
				var n = p.replace(/\./g,"\\.");
				var r = new RegExp("\\/\\*<"+n+">\\*\\/(.*?)\\/\\*<\\/"+n+">\\*\\/",'g')
				codes=codes.replace(r,function(match){
					i++;
					tmp[i] = "/*<"+p+">*/'"+_tmplMap[item][p]+"'/*</"+p+">*/";
					return '<@'+i+'@>';
				});
				codes=codes.replace(new RegExp(p.replace(/\./g,"\\."),'g'),function(match){
					i++;
					tmp[i] = "/*<"+p+">*/'"+_tmplMap[item][p]+"'/*</"+p+">*/";
					return '<@'+i+'@>';
				});
				codes=codes.replace(/<@(\d+)@>/g,function(match,i){
					return tmp[i];
				}); 
			}
			
			
			fs.writeFileSync(fileName,codes);
			
			MSG.log("文件合并完成："+path.normalize(fileName));
		});
		
		
	}
	this._init();
}

/**
 * 根据指定的目录遍历查找“build.qzmin”，如果查找到，建立map进行变更监听
 * @param {String} dir 目录地址
 */
var merger=function(dir){
	var buildFile=dir+'/'+BUILD_FILE;
	fs.exists(buildFile,function(exists){
		exists&&fs.readFile(buildFile,function(err,data){
			new Map(dir,eval('('+data+')'));
		});
	});
	fs.readdir(dir,function(err,files){
		files&&files.length&&files.forEach(function(item){
			fs.statSync(dir+'/'+item).isDirectory()&&merger(dir+'/'+item);
		});
	});
}

/**
 * GCC 压缩选项
 * @param {Number} level 压缩级别 1-普通压缩，2-深度压缩
 */
var compiler=function(level){
	var exec=function(sFileName,cFileName,option){
		MSG.log("正在压缩文件："+path.normalize(sFileName));
		try{
			var compiler=proc.exec('java -jar '+JAR_ROOT+'/compiler.jar '+option+' --js '+sFileName,function(error,stdout,stderr){
				if(error){
					MSG.log("文件压缩错误"+error,1);
				}
				else{
					fs.writeFileSync(cFileName,stdout);
					//已压缩
					MSG.log("文件压缩完成："+path.normalize(cFileName));
				}
				
			});
		}
		catch(e){
			MSG.log("文件压缩错误"+e.message,1);
		}
		
	}

	var option = {1:"--compilation_level WHITESPACE_ONLY",2:''}[level];

	RELEASE_FILE.forEach(function(item){
		exec(item.src,item.compiler,option);
	});

}
var publish = function(){
	RELEASE_FILE.forEach(function(item){	
		fs.readFile(item.src,function(err,data){
			if(err){
				MSG.log("源文件读取失败："+err.message,1);
			}
			else if(item.publish){
				fs.writeFile(item.publish,data+"",function(err){
					if(err){
						MSG.log("文件发布失败："+err.message,1);
					}
					else{
						MSG.log("文件发布成功："+item.publish);
					}
				})
			}
		})
	});
}
/**
 * 命令解析
 * @param {String} cmd 命令
 */
var command = {
	'reset':function(){
		PROCESS_MANAGER.forEach(function(tm){
			clearInterval(tm);
		});

		RELEASE_FILE = [];

		MSG.log('重启中...');
		merger(ROOT_DIR);
	},
	'gcc':function(level){
		level = level == 2 ? 2 :1;
		compiler(level);
	},
	'server':function(port){

	},
	'publish':function(){
		publish();
	},
	'version':function(){
		MSG.log(VERSION)
	},
	'help':function(){
		MSG.log("******************")
		MSG.log("gcc\t\t压缩目标文件")
		MSG.log("reset\t\t重启")
		MSG.log("publish\t发布目标文件")
		MSG.log("version\t获取版本号")
	}
};

//初始化，欢迎信息，启动merger
(function(){
	
	if(!MSG){
		MSG = new Msg();
	}
	
	MSG.hello(ROOT_DIR);
	merger(ROOT_DIR);



	process.stdin.resume();
	process.stdin.setEncoding('utf8');

	process.stdin.on('data', function(chunk) {
		
		var cmd = chunk.replace(/\r\n/g,'').replace(/[\r\n]/g,'').replace(/\s+/," ").trim().split(' ');
		if(command[cmd[0]]){
			command[cmd[0]].apply(this,cmd.slice(1));
		}

	});
})();



