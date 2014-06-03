var options = {
	read: function(){
		var config = {
				stash_base_url: localStorage["stash_config.stash_base_url"],
				interval: localStorage["stash_config.interval"]
		}

		if(config && config.stash_base_url)
			$("#base_url").val(config.stash_base_url);
		if(config && config.interval)
			$("#interval").val(config.interval);
	},
	validate: function(obj) {
		var isNumber = function(n) { return !isNaN(parseFloat(n)); }
		// is interval a number
		var ok = isNumber(obj.interval) ;
		if( !ok )
			return {ok: false, message: "Interval must be a number"}

		ok = obj.interval > 0;
		if( !ok )
			return {ok: false, message: "Interval must be greater than 0"}

		return {ok: true};
			
	},
  write: function(obj) {
		localStorage["stash_config.stash_base_url"] = obj.stash_base_url;
		localStorage["stash_config.interval"] = obj.interval;
	},
	save: function(e) {
		e.preventDefault();

		var conf = {
			stash_base_url: $("#base_url").val(),
			interval: $("#interval").val()
		};
		
		var validation = options.validate(conf);
		if( validation.ok )
		{
			options.write(conf);
			alert("saved...");
		}
		else
			alert(validation.message);
	}	
}

$(function(){
	options.read();
	$("input[type='submit']").click(options.save);
});
