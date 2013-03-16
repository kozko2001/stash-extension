var background = {
	config: {
		interval: 1
	},
	loadConfig: function()
	{
		console.log("loadConfig");
		if(background.timeout_token)
			clearInterval(this.timeout_token);
		
		background.requests.config.base_url = localStorage["stash_config.base_url"];
		background.config.interval = localStorage["stash_config.interval"];

		return !!this.timeout_token;
	},
	startTimeout: function(f)
	{
		if(!this.config.interval || !this.requests.config.base_url)	
			background.changeIcon("CONF");
		else
			this.timeout_token = setInterval(f, this.config.interval* 1000);
	},
	onTimeout: function()
	{
		background.requests.pull_requests("open", function(res){
			if(res.ok)
				background.changeIcon(res.result.size);
			else
				background.changeIcon(res.error.error);
		});
	},
	changeIcon: function(text)
	{
		chrome.browserAction.setBadgeText({text: ""+text});
	},
	requests: {
		config: {
			base_url: null,
		},
		construct_url: function(path)
		{
			return background.requests.config.base_url + path;
		},
		pull_requests: function(state, cb)
		{
			var url = this.construct_url("rest/inbox/latest/pull-requests")
			var _this = background.requests;
			$.getJSON(url, {start: 0, limit: 100, state: state, order: null, avatarSize: 64}, function (json){
				cb(_this.response_ok(json));
			}).error(function(xhr, status, error){
				cb(_this.response_error(status, xhr.status));
			});
		},
		response_ok: function(data){
			return { 
				ok: true,  
				result: data 
			}
		},
		response_error: function(status, error)
		{
			return { 
				ok: false, 
				error: {
					status: status, 
					error: error
				}
			}
		}

	}
};
document.addEventListener('DOMContentLoaded', function () {
	background.loadConfig();
	background.startTimeout(background.onTimeout);
	window.addEventListener('storage', function() { 
		background.loadConfig();
		background.startTimeout(background.onTimeout);
	}, false);

	chrome.browserAction.onClicked.addListener(function() {
		chrome.tabs.create({'url': background.requests.config.base_url});
	});
});
