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
var IS_RUN_COMPILER	=false;
var MEM			=0;
var UPDATE_HIS	={};
/**
 * @class Msg
 */
var Msg=function(){
	this.log=function(msg){
		console.log(msg+"\r\n");
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
	var _projects=build.projects,	//工程配置
		_path=dir+'/',				//根路径
		_mainMap={},				//{合并后的文件名:{include:JS文件数组,template:模版文件数组}}
		_fileMap={},				//{合并前的单个文件名:{target:合并后的文件名,time:最后更新时间,type:JS/模版}}
		_tmplMap={},				//{合并后的文件名:模版字符串}
		_level=parseInt(build.level)||0,		//0,不压缩 1、简单压缩  2、深度压缩		(3、已压缩过)	
		_self=this,
		msg=new Msg();
	
	//如果发现压缩选项	且当前未启动压缩监听
	if(_level&&!IS_RUN_COMPILER){
		IS_RUN_COMPILER=true;
		compiler()
	}
	
		
	//根据工程配置初始化map
	this._init=function(){
		
		msg.log('发现配置文件：'+path.normalize(_path+BUILD_FILE));
		
		//遍历工程
		_projects.forEach(function(item){		
			_mainMap[item.target]={};
			_mainMap[item.target].include=item.include||[];
			_mainMap[item.target].template=item.template||[];
			
			//一个文件可能在多个工程中被使用
			_mainMap[item.target].include.forEach(function(_item){
				_fileMap[_item]=_fileMap[_item]||{target:[],time:+fs.statSync(_path+_item).mtime,type:'js'};
				_fileMap[_item].target.push(item.target);
			});
			_mainMap[item.target].template.forEach(function(_item){
				_fileMap[_item]=_fileMap[_item]||{target:[],time:+fs.statSync(_path+_item).mtime,type:'tmpl'};
				_fileMap[_item].target.push(item.target);
				_self.initTemp(_item,[item.target]);
			});
			
		})
		
		//初始化合并
		for(var p in _mainMap){
			this.merge(_mainMap[p].include[0],[p],'js',new Date());
		}
		
		
		this.listen();
		
	};
	
	//定时监听_fileMap发现文件更新
	this.listen=function(){
		setInterval(function(){
			for(var p in _fileMap){
				var mtime=+fs.statSync(_path+p).mtime;		
				mtime!=_fileMap[p].time&&function(){
						msg.log('源文件有修改：'+path.normalize(_path+p));
						_fileMap[p].time=mtime;
						_self.merge(p,_fileMap[p].target,_fileMap[p].type,mtime);
				}()

			}
			
		},1000);
	};
	//初始化模版变量
	this.initTemp=function(file,target){
		var _tmplStr=fs.readFileSync(_path+file),
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
			_mainMap[item].include.forEach(function(item){
				//pool.push("//@file\t\t\t"+item+"\r\n//@Last-Modified\t"+new Date(mtime));
				pool.push(fs.readFileSync(_path+item));
			});
			
			var codes=pool.join("\r\n");

			
			for(var p in _tmplMap[item]){
				codes=codes.replace(new RegExp(p.replace(/\./g,"\\."),'g'),"'"+_tmplMap[item][p]+"'");
			}
			
			var fileName=_path+item;
			fs.writeFileSync(fileName,codes);
			
			//如果是新发现的，则加入列表
			!UPDATE_HIS[fileName]&&(UPDATE_HIS[fileName]=_level);
			msg.log("文件合并完成："+path.normalize(fileName));
		});
		
		
	}
	this._init();
}

//以当前目录为启动，递归查找，发现 build.qzmin则录入map
var run=function(dir){
	var buildFile=dir+'/'+BUILD_FILE;
	fs.exists(buildFile,function(exists){
		exists&&fs.readFile(buildFile,function(err,data){
			new Map(dir,eval('('+data+')'));
		});
	});
	fs.readdir(dir,function(err,files){
		files&&files.length&&files.forEach(function(item){
			fs.statSync(dir+'/'+item).isDirectory()&&run(dir+'/'+item);
		});
	});
}
//压缩
var compiler=function(){
	var msg=new Msg();
	var comp=function(fileName,level){
		UPDATE_HIS[fileName]=3;
		msg.log("正在压缩文件："+path.normalize(fileName));
		var compiler=proc.exec('java -jar '+JAR_ROOT+'/compiler.jar '+level+' --js '+fileName,function(error,stdout,stderr){
			if(error){
				msg.log("文件压缩错误"+error);
			}
			else{
				fs.writeFileSync(fileName,stdout);
				//已压缩
				msg.log("文件压缩完成："+path.normalize(fileName));
			}
			
		});
	}
	//压缩消耗性能，只检测未被压缩过的合并后的文件
	setInterval(function(){
		for(var fileName in UPDATE_HIS){
			var level=UPDATE_HIS[fileName];
			var cmd=['','--compilation_level WHITESPACE_ONLY',''];
			//如果存在切未压缩过
			if(level&&level<3){
				comp(fileName,cmd[level]);
			}
		}
	},1000);
}
//初始化，欢迎信息，启动查找
var init=function(){
	(new Msg()).hello(ROOT_DIR);
	run(ROOT_DIR);
}
init();
