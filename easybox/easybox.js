/*!
	Easybox v0.1 - Lightweight easy to use lightbox clone for jQuery
	Based on Slimbox2 by Christophe Beyls <http://www.digitalia.be>

	Copyright (C) 2011 by Vincent Wochnik

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.
*/

(function($) {
	// Global variables
	var options, resources, activeIndex = -1, prevIndex, nextIndex, centerWidth, centerHeight,
		hiddenElements = [], slideshowDirection = 0,
	// loading requisites
		imageObj = null, ajaxReq = null, inlineObj = null, inlineParent = null, slideshowInterval = null,
	// settings
		imageWidth = 0, imageHeight = 0, videoWidth = 0, videoHeight = 0, videoWidescreen = 0, loadError = false,
	// DOM elements
		overlay, center, container, prevLink, nextLink, bottomContainer, bottom, caption, number;

	/*
		Initialization
	*/
	$(function() {
		// append the easybox HTML code at the bottom of the document
		$("body").append(
			$([
				overlay = $('<div id="easyOverlay" />')[0],
				center = $('<div id="easyCenter" />').append([
					container = $('<div id="easyContainer" />')[0]
				])[0],
				prevLink = $('<a id="easyPrevLink" href="#" />').click(previous)[0],
				nextLink = $('<a id="easyNextLink" href="#" />').click(next)[0],
				bottomContainer = $('<div id="easyBottomContainer" />').append([
					bottom = $('<div id="easyBottom" />').append([
						$('<a id="easyCloseLink" href="#" />').add(overlay).click(close)[0],
						caption = $('<div id="easyCaption" />')[0],
						number = $('<div id="easyNumber" />')[0],
						$('<div style="clear: both;" />')[0]
					])[0]
				])[0]
			]).css("display", "none")
		);
	});


	/*
		API
		Opens easybox with the specified parameters
	*/
	$.easybox = function(_resources, startIndex, _options, rel) {
		var running = false;
		if (activeIndex >= 0) {
			// easybox already running
			stop();
			activeIndex = prevIndex = nextIndex = -1;
			slideshowDirection = 0;
			running = true;
		}

		// complete options
		options = $.extend({
			loop: false,               // navigate between first and last image
			dynOpts: true,            // checks for a <div id="prefix-options">
			overlayOpacity: 0.8,       // opacity of the overlay from 0 to 1
			resizeDuration: 400,       // box resize duration
			resizeEasing: 'easybox',   // resize easing method; 'swing' = default
			fadeDuration: 400,         // image fade-in duration
			initWidth: 250,            // width of the box in initial or error state
			initHeight: 250,           // height of the box in initial or error state
			defWidth: 960,             // default content width
			defHeight: 720,            // default content height
			closeWidth: 128,           // width the box fades to when closing
			closeHeight: 128,          // height the box fades to when closing
			maxWidth: 1280,            // maximum content width
			maxHeight: 720,            // maximum content height
			maxScreenFill: 0.7,        // content width/height are limited to screen width/height * x; 0 = disabled
			ytPlayerHeight: 480,       // youtube player height; 720, 480, 360, 240
			captionFadeDuration: 200,  // caption fade duration
			slideshow: 0,              // slideshow interval; 0 = disable slideshows
			counterText: "{x} of {y}", // counter text; {x} replaced with current image number; {y} replaced with total image count
			closeKeys: [27, 88, 67],   // array of keycodes to close easybox, default: Esc (27), 'x' (88), 'c' (67)
			previousKeys: [37, 80],    // array of keycodes to navigate to the previous image, default: Left arrow (37), 'p' (80)
			nextKeys: [39, 78]         // array of keycodes to navigate to the next image, default: Right arrow (39), 'n' (78)
		}, _options);
		
		// check for dynamic options inside html
		if ((options.dynOpts) && ($('#easyOptions').length)) {
			var o = $.parseJSON($('#easyOptions').html());
			$.each(o, function(key, val) {
				if ((key == 'global') || ((typeof rel == 'string') && (key == rel))) {
					options = $.extend(options, val);
				}
			});
		}

		// The function is called for a single image, with URL and Title as first two arguments
		if (typeof _resources == "string") {
			_resources = [[_resources, startIndex]];
			startIndex = 0;
		}

		// get maximum content dimensions
		if (options.maxScreenFill) {
			options.maxWidth = Math.min(Math.round(screen.width*options.maxScreenFill), options.maxWidth);
			options.maxHeight = Math.min(Math.round(screen.height*options.maxScreenFill), options.maxHeight);
		}

		// copy resources array and set loop option
		resources = _resources;
		options.loop = options.loop && (resources.length > 1);
		if (!running) {
			// initializing center
			centerWidth = options.initWidth;
			centerHeight = options.initHeight;
			$(center).css({width: centerWidth, height: centerHeight, marginLeft: -centerWidth/2, marginTop: -centerHeight/2, opacity: ""});

			setup(1);

			$(center).show();
			$(overlay).css("opacity", options.overlayOpacity).fadeIn(options.fadeDuration, function() {
				change(startIndex);
			});
		} else {
			change(startIndex);
		}

		return false;
	};

	/*
		options:     Optional options object given to $.easybox function
		linkMapper:  Optional function taking a link DOM element and an index as arguments and returning an array containing 2 elements:
		             the image URL and the image caption (may contain HTML)
		linksFilter: Optional function taking a link DOM element and an index as arguments and returning true if the element is part of
		             the image collection that will be shown on click, false if not. "this" refers to the element that was clicked.
		             This function must always return true when the DOM element argument is "this".
		             This function must not return true when the rel tags of the DOM element and *this* are not equal.
		rel:         EasyBox looks for this in #easyOptions tags
	*/
	$.fn.easybox = function(_options, linkMapper, linksFilter) {
		linkMapper = linkMapper || function(el) {
			return [el.href, el.title];
		};

		linksFilter = linksFilter || function(el) {
			return (this == el);
		};

		var links = this;
		return links.unbind("click").click(function() {
			// Build the list of resources that will be displayed
			var link = this, startIndex = 0, filteredLinks, i = 0, length;
			filteredLinks = $.grep(links, function(el, i) {
				return linksFilter.call(link, el, i);
			});

			// We cannot use jQuery.map() because it flattens the returned array
			for (length = filteredLinks.length; i < length; ++i) {
				if (filteredLinks[i] == link) startIndex = i;
				filteredLinks[i] = linkMapper(filteredLinks[i], i);
			}
			return $.easybox(filteredLinks, startIndex, _options, $(link).attr('rel') || null);
		});
	};


	/*
		Setup and unsetup function
	*/
	function setup(open) {
		if (open) {
			$("object").add("embed").each(function(index, el) {
				hiddenElements[index] = [el, el.style.visibility];
				el.style.visibility = "hidden";
			});
		} else {
			$.each(hiddenElements, function(index, el) {
				el[0].style.visibility = el[1];
			});
			hiddenElements = [];
		}
		var fn = open ? "bind" : "unbind";
		$(document)[fn]("keydown", keyDown);
	}

	/*
		Key handling function
	*/
	function keyDown(event) {
		var code = event.keyCode, fn = $.inArray;
		// Prevent default keyboard action (like navigating inside the page)
		return (fn(code, options.closeKeys) >= 0) ? close()
			: (fn(code, options.nextKeys) >= 0) ? next()
			: (fn(code, options.previousKeys) >= 0) ? previous()
			: false;
	}

	/*
		Jump to previous resource
	*/
	function previous() {
		slideshowDirection = 1;	// backwards
		return change(prevIndex);
	}

	/*
		Jump to next resource
	*/
	function next() {
		slideshowDirection = 0;	// forwards
		return change(nextIndex);
	}

	/*
		Change resource
	*/
	function change(index) {
		if (index >= 0) {
			activeIndex = index;
			prevIndex = (activeIndex || (options.loop ? resources.length : 0)) - 1;
			nextIndex = ((activeIndex + 1) % resources.length) || (options.loop ? 0 : -1);
			
			// reset everything
			stop();
			
			// preload previous and next image
			if ((prevIndex >= 0) && (/(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[prevIndex][0])))
				(new Image()).src = resources[prevIndex][0];
			if ((nextIndex >= 0) && (/(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[nextIndex][0])))
				(new Image()).src = resources[nextIndex][0];

			if (imageLink()) {
				$(center).addClass("easyLoading");
				imageObj = new Image();
				imageObj.onload = function() {
					imageWidth = this.width;
					imageHeight = this.height;
					animateBox();
				};
				imageObj.onerror = function() {
					loadError = true;
					animateBox();
				}
				imageObj.src = resources[activeIndex][0];
			} else if ((id = youtubeLink()) != false) {
				$(center).addClass("easyLoading");
				ajaxReq = $.ajax('http://gdata.youtube.com/feeds/api/videos?v=2&alt=jsonc', {
					type: 'GET',
					data: {q: id},
					dataType: 'jsonp',
					timeout: 2000,
					success: function(r) {
						if (r.data.totalItems) {
							if (r.data.items[0].accessControl.embed == "allowed")
								videoWidescreen = (r.data.items[0].aspectRatio == "widescreen");
							else
								loadError = true;
						}
						animateBox();
					},
					error: function(x, t) {
						if (t != "abort") {
							loadError = true;
							animateBox();
						}
					}});
			} else if ((id = vimeoLink()) != false) {
				$(center).addClass("easyLoading");
				ajaxReq = $.ajax('http://vimeo.com/api/v2/video/'+id+'.json', {
					type: 'GET',
					dataType: 'jsonp',
					timeout: 2000,
					success: function(r) {
						if (r.length) {
							if ((r[0].embed_privacy == 'anywhere') || (r[0].embed_privacy == 'approved')) {
								videoWidth = r[0].width || 0;
								videoHeight = r[0].height || 0;
							} else {
								loadError = true;
							}
						}
						animateBox();
					},
					error: function(x, t) {
						if (t != "abort") {
							loadError = true;
							animateBox();
						}
					}});
			} else {
				// don't need preloading
				animateBox();
			}
		}

		return false;
	}

	/*
		Animates the box
		Called by change()
	*/
	function animateBox() {
		var d, e;

		// remove loading animation
		$(center).removeClass();

		if (!loadError) {
			if (imageLink()) {
				d = limitDim({w: imageWidth, h: imageHeight});
				e = $("<img src=\""+resources[activeIndex][0]+"\" width=\""+d.w+"\" height=\""+d.h+"\" alt=\""+resources[activeIndex][1]+"\" />");
			} else if ((id = youtubeLink()) != false) {
				d = limitDim({w: Math.round(options.ytPlayerHeight*((videoWidescreen) ? (16.0/9.0) : (4.0/3.0))), h: options.ytPlayerHeight});
				e = $("<iframe src=\"http://www.youtube.com/embed/"+id+"?version=3&autohide=1&autoplay=1&rel=0\" width=\""+d.w+"\" height=\""+d.h+"\" frameborder=\"0\"></iframe>");
			} else if ((id = vimeoLink()) != false) {
				d = limitDim({w: videoWidth, h: videoHeight});
				e = $("<iframe src=\"http://player.vimeo.com/video/"+id+"?title=0&byline=0&portrait=0&autoplay=true\" width=\""+d.w+"\" height=\""+d.h+"\" frameborder=\"0\"></iframe>");
			} else if ((id = anchorLink()) != false) {
				inlineObj = $('#'+id)[0];
				inlineParent = $(inlineObj).parent();
				d = limitDim({w: $(inlineObj).width(), h: $(inlineObj).height()});
				e = $(inlineObj).css({display: "block"});
			} else {
				d = limitDim({});
				e = $("<iframe width=\""+d.w+"\" height=\""+d.h+"\" src=\""+resources[activeIndex][0]+"\" frameborder=\"0\"></iframe>");
			}
			
			// retrieve center dimensions
			$(container).css({visibility: "hidden", display: ""}).width(d.w).height(d.h);
			centerWidth = container.offsetWidth;
			centerHeight = container.offsetHeight;
			
			// set caption and number
			$(caption).html(resources[activeIndex][1] || "");
			$(number).html((((resources.length > 1) && options.counterText) || "").replace(/{x}/, activeIndex + 1).replace(/{y}/, resources.length));
		} else {
			$(center).addClass("easyError");
			centerWidth = options.initWidth;
			centerHeight = options.initHeight;

			// clear caption and number
			$([caption, number]).html("");
		}
		
		// resize center
		if ((center.offsetHeight != centerHeight) || (center.offsetWidth != centerWidth))
			$(center).animate({height: centerHeight, marginTop: -centerHeight/2, width: centerWidth, marginLeft: -centerWidth/2}, options.resizeDuration, options.resizeEasing);

		$(center).queue(function() {
			$(bottomContainer).css({width: centerWidth, marginLeft: -centerWidth/2, marginTop: centerHeight/2});
			$(prevLink).css({marginLeft: -centerWidth/2 - Math.floor($(prevLink).width() * 1.5)});
			$(nextLink).css({marginLeft: centerWidth/2 + Math.ceil($(prevLink).width() * 0.5)});
			$(container).append(e).css({display: "none", visibility: "", opacity: ""}).fadeIn(options.fadeDuration, animateCaption);
			if ((options.slideshow) && (nextIndex >= 0))
				slideshowInterval = setInterval((slideshowDirection) ? previous : next, options.slideshow);
		});
	}

	/*
		Animates the caption
		Called by animateBox() when finished
	*/
	function animateCaption() {
		if (prevIndex >= 0) $(prevLink).css({display: "none", visibility: "", opacity: ""}).fadeIn(options.captionFadeDuration);
		if (nextIndex >= 0) $(nextLink).css({display: "none", visibility: "", opacity: ""}).fadeIn(options.captionFadeDuration);

		// fade in		
		$(bottomContainer).css({opacity: ""}).fadeIn(options.captionFadeDuration);
		$(bottom).css("marginTop", -bottom.offsetHeight).animate({marginTop: 0}, options.captionFadeDuration);
	}

	/*
		Stops all animation and resets the box to a clear state
		Called by close() and change()
	*/
	function stop() {
		// reset everything to init state
		$(center).removeClass();
		if (imageObj != null) { imageObj.onload = imageObj.onerror = null; imageObj = null; }
		if (ajaxReq != null) { ajaxReq.abort(); ajaxReq = null; }		
		if (slideshowInterval != null) {clearInterval(slideshowInterval); slideshowInterval = null; }
		if (inlineObj != null) {
			// put inline object back to it's place
			$("body").append($(inlineObj).css({display: ""}));
			inlineObj = inlineParent = null;
		}
		videoWidescreen = loadError = false;
		imageWidth = imageHeight = 0;
		videoWidth = videoHeight = 0;
		$(container).empty();
		$([center, bottom]).stop(true);
		$([container, bottomContainer, prevLink, nextLink]).stop(true).css({display: "none"});
	}

	/*
		Closes the box
	*/
	function close() {
		if (activeIndex >= 0) {
			stop();
			activeIndex = prevIndex = nextIndex = -1;
			slideshowDirection = 0;
			// resize center
			$(overlay).stop().fadeOut(options.fadeDuration, setup);
			$(center).animate({height: options.closeHeight, marginTop: -options.closeHeight/2, width: options.closeWidth, marginLeft: -options.closeWidth/2, opacity: 0}, options.fadeDuration, function() {
				$(center).hide();
			});
		}

		return false;
	}
	
	/* returns true if the link is an image */
	function imageLink() {
		return /(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[activeIndex][0]);
	}
	
	/* returns the youtube id if active link is a youtube link */
	function youtubeLink() {
		var r = /^http\:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9]*)(&(.*))?$/i.exec(resources[activeIndex][0]);
		return (r != null) ? r[1] : false;
	}

	/* returns the vimeo id if active link is a vimeo link */
	function vimeoLink() {
		var r = /^http\:\/\/vimeo\.com\/([0-9]*)(.*)?$/i.exec(resources[activeIndex][0]);
		return (r != null) ? r[1] : false;
	}
	
	/* returns the name of an element if active link is an anchor */
	function anchorLink() {
		var r = /^(.*)\#([A-Za-z0-9\-_]*)$/i.exec(resources[activeIndex][0]);
		return ((r != null) && ($('#'+r[2]).length)) ? r[2] : false;
	}
	
	/* limits dimensions */
	function limitDim(d) {
		if (!((d.w > 0) && (d.h > 0))) {
			d.w = options.defWidth;
			d.h = options.defHeight;
		}
		
		if (d.h > options.maxHeight) { d.w = Math.round(options.maxHeight*d.w/d.h); d.h = options.maxHeight; }
		if (d.w > options.maxWidth) { d.h = Math.round(options.maxWidth/d.w*d.h); d.w = options.maxWidth; }
		
		return d;
	}
	
	/* easing function with a little bounce effect */
	$.easing.easybox = function(t, millisecondsSince, startValue, endValue, totalDuration) {
		if (t < 0.7) {
			return Math.pow(t/0.7, 2)*1.2;
		} else {
			return 1.2-Math.sqrt((t-0.7)/(1-0.7))*0.2;
		}
	}
})(jQuery);
