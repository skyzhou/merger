merger.js是什么？
---------------
	merger.js是一款基于node.js的Web前端工程管理工具。merger.js能遍历搜索工程目录中的工程配置信息，根据配置将JS、样式、模版合并/压缩。


特性
---------------
	＊能将静态html，样式压为字符串赋给JS变量。
	＊实时响应，在开启merger监听时，修改源码或模版立即合并生成发布文件
	＊可扩展GCC压缩


如何使用
---------------
	1、在工程根目录新建build.qzmin文件，如：

	{
		projects:[
			{
				target:'test/index.js',
				include:[
					'test/src/js/'
				],
				template:[
					'test/src/template/'
				]
			}
		]
	}

	-- projects	：工程列表。允许在一个“build.qzmin”配置多个工程，数组
	-- target 	：合并生成的发布文件路径（相对路径参照 “build.qzmin” 文件路径，以下相同），工程内唯一，字符串
	-- include	：参与合并的JS文件路径列表，支持文件夹和单个文件路径（文件夹下所有JS文件参与合并），数组
	-- template ：参与合并的模版路径列表，支持文件夹和单个文件路径，（文件夹下所有模版文件参与合并），数组

	2、将merger.js拷贝到工程根目录或上级目录。用node.js运行merger.js。工具会遍历目录查找“build.qzmin”文件并监听

	3、修改源码（参与合并的JS文件（include）或模版（template）），自动生成发布文件（target）


神器 -> 模版
-------------
	1、在参与合并的任意JS文件中写这样一行代码
   		var html = TEST.TPL.HTML

	2、在参与合并的任意模版文件中写这样几行代码
   
   		<template name="TEST.TPL.HTML">
   			<div>test</div>
   		</template>

	3、打开生成的发布文件，发现步骤1添加的JS代码变成这样

   		var html = ‘<div>test</div>’   


 window平台的merger.exe
 -------------------

 	merger.exe = node.exe + merger.js + gcc

 	1、直接将merger.exe拷贝到工程根目录或上级目录，双击运行，即自动运行合并监听。
 	2、在运行界面输入“gcc 1”将对生成的发布文件进行平台压缩（去除换行和注释），输入“gcc 2”进行深度压缩（变量替换，逻辑优化）。
 	3、压缩会校验语法，如文件有语法错误，将会把错误抛在运行界面





