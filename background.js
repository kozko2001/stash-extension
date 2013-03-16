var background = {
	startTimeout: function(f)
	{
		this.timeout_token = setInterval(f, 1000);
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
		construct_url: function(path)
		{
			return "http://192.168.3.53:7990/" + path;
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
	background.startTimeout(background.onTimeout);
});
