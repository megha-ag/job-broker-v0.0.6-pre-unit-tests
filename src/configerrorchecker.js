var util = require('util');
exports.checker = function(cb, cp) {
	var callback = cb;
	var configPath = cp;
	
	var checker = {};
	
	//This object will be passed to the callback if callback is defined
	var resultObj;
	
	//We need to check that a queue with particular module and name is defined only once
	//Thus, we maintain a simple hashtable of queuemoduleName + queueName
	var queueMap = {};
	
	//Callback with error result
	function makeCallback() {
		if(callback) {
			callback(resultObj);
		}
	}
	
	//Check that the config file exists
	checker.checkFileExistsError = function(errorCodes, fs, path) {
		//Check if file exists
		try {
			// Query the entry
			var stats = fs.lstatSync(configPath);

			// Is it a directory?
			if (stats.isDirectory()) {
				resultObj = errorCodes.getError("brokerConfig_ConfigFileNotFound");
				resultObj.errorMessage = util.format(resultObj.errorMessage, configPath);
				makeCallback();
				return true;
			}
		}
		catch (e) {
			//It doesn't exist
			resultObj = errorCodes.getError("brokerConfig_ConfigFileNotFound");
			resultObj.errorMessage = util.format(resultObj.errorMessage, configPath);
			makeCallback();
			return true;
		}
		return false;
	};
	
	//Checks if there is a JSON error while loading config
	checker.checkJsonLoadingError = function(errorCodes, config, configPath) {
		try
		{
			//Try parsing the JSON file
			config.file({ file: configPath });
		}
		catch(err) {
			//Could not parse
			resultObj = errorCodes.getError("brokerConfig_CouldNotLoadJson");
			makeCallback();
			return true;
		}
		return false;
	};
	
	//The workers node must be defined in the config
	checker.checkWorkersNode = function(errorCodes, workerObjs) {
		if(!workerObjs) {
			//The workers node is not defined
			resultObj = errorCodes.getError("brokerConfig_WorkersNotSpecified");
			makeCallback();
			return true;
		}
		
		if(!workerObjs.length) {
			//The workers node doesn't have any workers
			resultObj = errorCodes.getError("brokerConfig_NoWorkers");
			makeCallback();
			return true;
		}
		
		return false;
	};
	
	//The job-type must be specified
	checker.checkJobType = function(errorCodes, workerConfig, i) {
		if(!workerConfig["job-type"]) {
			//The object node doesn't have any job-type
			resultObj = errorCodes.getError("brokerConfig_JobTypeMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		return false;
	};
	
	//A worker must be defined
	checker.checkWorkerNode = function(errorCodes, workerConfig, i) {
		if(!workerConfig.worker) {
			//The object node doesn't define a worker
			resultObj = errorCodes.getError("brokerConfig_WorkerNodeMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		return false;
	};
	
	//A worker's module must be defined
	checker.checkWorkerModule = function(errorCodes, workerObj, i) {
		if(!workerObj["worker-module"]) {
			//The worker object node doesn't define a worker-module
			resultObj = errorCodes.getError("brokerConfig_WorkerModuleMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		return false;
	};
	
	//Check that the worker module can be loaded
	checker.checkLoadWorkerModule = function(errorCodes, path, workerObj, workerModuleName, i, checkerObj) {
		//Path to the module
		var workerModulePath;
		if(workerModuleName.length > 3 && workerModuleName.substring(workerModuleName.length - 2).toLowerCase() === "js") {
			workerModulePath = path.join(__dirname, "../../../" + workerModuleName);
		}
		else {
			workerModulePath = path.join(__dirname, "workers/" + workerModuleName + ".js");
		}
		
		try
		{
			//Try to load from the files
			checkerObj.workerModule = require(workerModulePath).worker();
		}
		catch(err) {
			//The worker module could not be loaded
			resultObj = errorCodes.getError("brokerConfig_WorkerModuleCouldNotBeLoaded");
			resultObj.errorMessage = util.format(resultObj.errorMessage, workerModuleName);
			makeCallback();
			return true;
		}
		
		try
		{
			//Try to initialize with settings from the file
			checkerObj.workerModule.init(workerObj["worker-settings"]);
		}
		catch(err) {
			//The worker module could not be initialized
			resultObj = errorCodes.getError("brokerConfig_WorkerModuleCouldNotBeInitialized");
			resultObj.errorMessage = util.format(resultObj.errorMessage, workerModuleName, err);
			makeCallback();
			return true;
		}
		return false;
	};
	
	//Check that a queue is specified
	checker.checkQueueNode = function(errorCodes, workerConfig, i) {
		if(!workerConfig.queue) {
			//The object node doesn't define a queue
			resultObj = errorCodes.getError("brokerConfig_QueueNodeMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		return false;
	};
	
	//Check that a queue module is specified
	checker.checkQueueModule = function(errorCodes, queueObj, i) {
		if(!queueObj["queue-module"]) {
			//The queue object node doesn't define a queue-module
			resultObj = errorCodes.getError("brokerConfig_QueueModuleMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		return false;
	};
	
	//Check that the queue name is specified
	checker.checkQueueName = function(errorCodes, queueObj, i) {
		if(!queueObj["queue-name"]) {
			//The queue object node doesn't define a queue-name
			resultObj = errorCodes.getError("brokerConfig_QueueNameMissing");
			resultObj.errorMessage = util.format(resultObj.errorMessage, (i + 1));
			makeCallback();
			return true;
		}
		//Check that it is complaint with our names policy
		var patt1 = /^[a-z0-9]+$/i;
		if(queueObj["queue-name"].length > 15 || !patt1.test(queueObj["queue-name"])) {
			//The queuename is invalid
			resultObj = errorCodes.getError("brokerConfig_QueueNameInvalid");
			resultObj.errorMessage = util.format(resultObj.errorMessage, queueObj["queue-name"]);
			makeCallback();
			patt1 = null;
			return true;
		}
		
		patt1 = null;
		return false;
	};
	
	//Check that the queue module can be loaded
	checker.checkLoadQueueModule = function(errorCodes, path, jobType, queueModuleName, queueName, queueObj, i, chk) {
		//Path to the module
		var queueModulePath;
		if(queueModuleName.length > 3 && queueModuleName.substring(queueModuleName.length - 2).toLowerCase() === "js") {
			queueModulePath = path.join(__dirname, "../../../" + queueModuleName);
		}
		else {
			queueModulePath = path.join(__dirname, "queues/" + queueModuleName + ".js");
		}
		
		try
		{
			//Try to load the module
			chk.queueModule = require(queueModulePath).load((i+1), jobType, queueModuleName, queueName, queueObj["queue-settings"]);
		}
		catch(err) {
			//The queue module could not be loaded
			resultObj = errorCodes.getError("brokerConfig_QueueModuleCouldNotBeLoaded");
			resultObj.errorMessage = util.format(resultObj.errorMessage, queueModuleName);
			makeCallback();
			return true;
		}
		
		try
		{
			//Try to initialize
			chk.queueModule.init();
		}
		catch(err) {
			//The queue module could not be initialized
			resultObj = errorCodes.getError("brokerConfig_QueueModuleCouldNotBeInitialized");
			resultObj.errorMessage = util.format(resultObj.errorMessage, queueModuleName, err);
			makeCallback();
			return true;
		}
		
		return false;
	};
	
	//A particular queue (with module M and name N) cannot be defined twice
	checker.checkQueueConstraint = function(errorCodes, queueModuleName, queueName) {
		var qm = queueModuleName.toLowerCase();
		var qn = queueName.toLowerCase();
		if(queueMap[qm + "," + qn]) {
			//It's already defined
			resultObj = errorCodes.getError("brokerConfig_QueueDefinedTwice");
			resultObj.errorMessage = util.format(resultObj.errorMessage, queueModuleName, queueName);
			makeCallback();
			return true;
		}
		else {
			queueMap[qm + "," + qn] = qm + "," + qn;
		}
		
		return false;
	};
	
	return checker;
};