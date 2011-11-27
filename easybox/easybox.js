/*
	Easybox v1.1 - Lightweight easy to use lightbox clone for jQuery
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
	var defaults, options, resources, activeIndex = -1, prevIndex, nextIndex, centerWidth, centerHeight,
		hiddenElements = [], slideshowDirection = false, slideshowOff = false,
	// drag and drop vars
		dragging = false, dragOffX = 0, dragOffY = 0,
	// loading requisites
		busy = false, imageObj = null, ajaxReq = null, inlineObj = null, inlineParent = null, inlineDisplay = null, busyTimeout = null, slideshowTimeout = null, closeTimeout = null,
	// settings
		resourceWidth = 0, resourceHeight = 0, videoWidescreen = 0, loadError = false,
	// DOM elements
		overlay, center, container, navLinks, prevLink, nextLink, slideLink, closeLink, bottomContainer, bottom, caption, number;

	/*
		Initialization
	*/
	$(function() {
		// set defaults
		defaults = {
			loop: false,                  // navigate between first and last image
			loopVideos: false,            // loop videos
			dynOpts: true,                // checks for a <div id="prefix-options">
			dragDrop: true,               // enable window drag and drop
			hideBottom: false,            // hide bottom container
			hideCaption: false,           // hide caption and number
			hideButtons: false,           // hide buttons
			noNavigation: false,          // disable navigation
			noClose: false,               // disable close, only autoclose works
			overlayOpacity: 0.8,          // opacity of the overlay from 0 to 1
			resizeDuration: 400,          // box resize duration
			resizeEasing: 'easybox',      // resize easing method; 'swing' = default
			fadeDuration: 400,            // image fade-in duration
			initWidth: 250,               // width of the box in initial or error state
			initHeight: 250,              // height of the box in initial or error state
			defWidth: 960,                // default content width
			defHeight: 720,               // default content height
			closeWidth: 128,              // width the box fades to when closing
			closeHeight: 128,             // height the box fades to when closing
			maxWidth: 1280,               // maximum content width
			maxHeight: 720,               // maximum content height
			maxScreenFill: 0.7,           // content width/height are limited to screen width/height * x; 0 = disabled
			ytPlayerHeight: 480,          // youtube player height; 720, 480, 360, 240
			ytPlayerTheme: 'light,white', // youtube player theme; dark/light,red/white; 
			captionFadeDuration: 200,     // caption fade duration
			slideshow: 0,                 // slideshow interval; 0 = disable slideshows
			autoClose: 0,                 // close after x milliseconds; 0 = disable autoClose
			busyTimeout: 800,             // enables user controls after a timeout
			counterText: "{x} of {y}",    // counter text; {x} replaced with current image number; {y} replaced with total image count
			closeKeys: [27, 88, 67],      // array of keycodes to close easybox, default: Esc (27), 'x' (88), 'c' (67)
			previousKeys: [37, 80],       // array of keycodes to navigate to the previous image, default: Left arrow (37), 'p' (80)
			nextKeys: [39, 78],           // array of keycodes to navigate to the next image, default: Right arrow (39), 'n' (78)
			preventOtherKeys: true        // prevents handling of other keys
		};
		
		// append the easybox HTML code at the bottom of the document
		$("body").append(
			$([
				overlay = $('<div id="easyOverlay" />').click(close)[0],
				center = $('<div id="easyCenter" />').append([
					container = $('<div id="easyContainer" />')[0]
				])[0],
				bottomContainer = $('<div id="easyBottomContainer" />').append([
					bottom = $('<div id="easyBottom" />').append([
						navLinks = $('<div id="easyNavigation" />').append([
							prevLink = $('<a id="easyPrevLink" href="#" />').click(previous)[0],
							nextLink = $('<a id="easyNextLink" href="#" />').click(next)[0]
						])[0],
						closeLink = $('<a id="easyCloseLink" href="#" />').click(close)[0],
						slideLink = $('<a id="easySlideLink" href="#" />').click(toggleSlide)[0],
						caption = $('<div id="easyCaption" />')[0],
						number = $('<div id="easyNumber" />')[0],
						$('<div style="clear: both;" />')[0]
					])[0]
				])[0]
			]).css("display", "none")
		);
		
		// drag and drop functionality
		$([center, bottomContainer]).mousedown(dragStart).mousemove(dragMove).mouseup(dragStop);
		$(window).mouseup(dragStop);
	});


	/*
		API
		Opens easybox with the specified parameters
	*/
	$.easybox = function(_resources, startIndex, _options, rel) {
		if (activeIndex >= 0)
			return false;

		// complete options
		options = $.extend({}, defaults, _options);
		
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
			resources = [[_resources, startIndex || ""]];
			startIndex = 0;
		} else {
			var i = 0, len;
			resources = [];
			for (len = _resources.length; i < len; ++i) {
				if (typeof _resources[i] == "string")
					resources.push([_resources[i], ""]);
				else
					resources.push([_resources[i][0], _resources[i][1] || ""]);
			}
			startIndex = startIndex || 0;
		}

		// get maximum content dimensions
		if (options.maxScreenFill) {
			options.maxWidth = Math.min(Math.round(screen.width*options.maxScreenFill), options.maxWidth);
			options.maxHeight = Math.min(Math.round(screen.height*options.maxScreenFill), options.maxHeight);
		}

		// copy resources array and set loop option
		options.loop = ((options.loop) && (resources.length > 1));
		options.slideshow = ((options.slideshow) && (resources.length > 1)) ? options.slideshow : 0;
		
		// show slideshow button if slideshow and not disabled
		$(slideLink).css({display: (((options.slideshow) && (resources.length > 1) && (!options.hideButtons)) ? '' : 'none')})
		// show close button if not disabled
		$(closeLink).css({display: ((!options.hideButtons) ? '' : 'none')})

		// initializing center
		centerWidth = options.initWidth;
		centerHeight = options.initHeight;
		$(center).css({width: centerWidth, height: centerHeight, marginLeft: -centerWidth/2, marginTop: -centerHeight/2, opacity: ""});

		setup(1);
		stop();

		$(center).show();
		$(overlay).css("opacity", options.overlayOpacity).fadeIn(options.fadeDuration, function() {
			change(startIndex);
		});

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
			var link = this, startIndex = 0, filteredLinks, i = 0, len;
			filteredLinks = $.grep(links, function(el, i) {
				return linksFilter.call(link, el, i);
			});

			// We cannot use jQuery.map() because it flattens the returned array
			for (len = filteredLinks.length; i < len; ++i) {
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
			$("object:visible").add("embed").each(function(index, el) {
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
		
		// key handling
		$(document)[fn]("keydown", keyDown);

		// mousewheel functionality
		if ($.fn.mousewheel) {
			$(window)[fn]('mousewheel', mouseWheel);
		}
	}

	/*
		Key handling function
	*/
	function keyDown(event) {
		var code = event.keyCode, fn = $.inArray;
		// Prevent default keyboard action (like navigating inside the page)
		return (busy) ? true
			: (fn(code, options.closeKeys) >= 0) ? close()
			: ((fn(code, options.nextKeys) >= 0) && (!options.noNavigation)) ? next()
			: ((fn(code, options.previousKeys) >= 0) && (!options.noNavigation)) ? previous()
			: (!options.preventOtherKeys);
	}

	/*
		Mouse wheel handling function
	*/
	function mouseWheel(event, delta) {
		return (busy) ? true
			: ((delta > 0) && (!options.noNavigation)) ? previous()
			: ((delta < 0) && (!options.noNavigation)) ? next()
			: (!options.preventOtherKeys);
	}
			
	/*
		Jump to previous resource
	*/
	function previous() {
		slideshowDirection = true;	// backwards
		return change(prevIndex);
	}

	/*
		Jump to next resource
	*/
	function next() {
		slideshowDirection = false;	// forwards
		return change(nextIndex);
	}
	
	/* creates timeout for slideshow and autoclose */
	function setTimers() {
		if ((options.slideshow) && (!slideshowOff) && (slideshowTimeout == null)) {
			if ((slideshowDirection) && (prevIndex >= 0)) { // backwards
				slideshowTimeout = setTimeout(previous, options.slideshow);
				return false;
			} else if ((!slideshowDirection) && (nextIndex >= 0)) { // forwards
				slideshowTimeout = setTimeout(next, options.slideshow);
				return false;
			}
		}
		
		if ((options.autoClose) && (closeTimeout == null))
			closeTimeout = setTimeout(autoClose, options.autoClose);
		return false;
	}
	
	function setBusyTimeout() {
		if (options.busyTimeout) {
			busyTimeout = setTimeout(notBusy, options.busyTimeout);
		}
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
			
			// set busy timeout
			setBusyTimeout();
			
			// preload previous and next image
			if ((prevIndex >= 0) && (/(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[prevIndex][0])))
				(new Image()).src = resources[prevIndex][0];
			if ((nextIndex >= 0) && (/(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[nextIndex][0])))
				(new Image()).src = resources[nextIndex][0];

			if (imageLink()) {
				preloadImage();
			} else if ((id = youtubeLink()) != false) {
				preloadAjax(0, id);	// youtube
			} else if ((id = vimeoLink()) != false) {
				preloadAjax(1, id); // vimeo
			} else {
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
		var d, // dimensions
			e; // embedded element

		if (!loadError) {
			if (imageLink()) {
				d = limitDim({w: resourceWidth, h: resourceHeight});
				e = $("<img src=\""+resources[activeIndex][0]+"\" width=\""+d.w+"\" height=\""+d.h+"\" alt=\""+resources[activeIndex][1]+"\" />");
			} else if ((id = youtubeLink()) != false) {
				var p = '?version=3&autohide=1&autoplay=1&rel=0'; // params
				if ((options.ytPlayerTheme) && ((r = /^([a-z]*),([a-z]*)$/.exec(options.ytPlayerTheme)) != null))
					p += '&theme='+r[1]+'&color='+r[2];
				if (options.loopVideos)
					p += '&loop=1&playlist='+id; // youtube glitch; needs playlist for loop
				d = limitDim({w: Math.round(options.ytPlayerHeight*((videoWidescreen) ? (16.0/9.0) : (4.0/3.0))), h: options.ytPlayerHeight});
				e = $("<iframe src=\"http://www.youtube.com/embed/"+id+p+"\" width=\""+d.w+"\" height=\""+d.h+"\" frameborder=\"0\"></iframe>");
			} else if ((id = vimeoLink()) != false) {
				var p = '?title=0&byline=0&portrait=0&autoplay=true';
				d = limitDim({w: resourceWidth, h: resourceHeight});
				if (options.loopVideos)
					p += '&loop=true';
				e = $("<iframe src=\"http://player.vimeo.com/video/"+id+p+"\" width=\""+d.w+"\" height=\""+d.h+"\" frameborder=\"0\"></iframe>");
			} else if ((id = anchorLink()) != false) {
				inlineObj = $('#'+id)[0];
				inlineParent = $(inlineObj).parent();
				inlineDisplay = $(inlineObj).css('display');
				d = limitDim({w: $(inlineObj).width(), h: $(inlineObj).height()});
				e = $(inlineObj);
			} else {
				d = limitDim({});
				e = $("<iframe width=\""+d.w+"\" height=\""+d.h+"\" src=\""+resources[activeIndex][0]+"\" frameborder=\"0\"></iframe>");
			}
			
			// retrieve center dimensions
			$(container).css({visibility: "hidden", display: ""}).width(d.w).height(d.h);
			centerWidth = container.offsetWidth;
			centerHeight = container.offsetHeight;
			
			// set caption and number
			if (resources[activeIndex][1].length)
				$(caption).html(resources[activeIndex][1]).css({display: ''});
			if ((resources.length > 1) && (options.counterText.length))
				$(number).html(options.counterText.replace(/{x}/, activeIndex + 1).replace(/{y}/, resources.length)).css({display: ''});
		} else {
			$(center).addClass("easyError");
			centerWidth = options.initWidth;
			centerHeight = options.initHeight;
			
			// no contents
			e = null;
		}
		
		// resize center
		if ((center.offsetHeight != centerHeight) || (center.offsetWidth != centerWidth))
			$(center).animate({height: centerHeight, marginTop: -centerHeight/2, width: centerWidth, marginLeft: -centerWidth/2}, options.resizeDuration, options.resizeEasing);

		// gets executed after animation effect
		$(center).queue(function() {
			// position and sizing
			$(bottomContainer).css({width: centerWidth, marginLeft: -centerWidth/2, marginTop: centerHeight/2});
			// append contents and fade in
			$(container).css({display: "none", visibility: "", opacity: ""});
			if (e != null)
				$(e).css({display: 'block'}).appendTo(container);
			$(container).fadeIn(options.fadeDuration, animateCaption);
			setTimers();
			busy = false;
		});
	}

	/*
		Animates the caption
		Called by animateBox() when finished
	*/
	function animateCaption() {
		if (options.hideBottom)
			return;

		if ((prevIndex >= 0) || (nextIndex >= 0) && (!options.noNavigation) && (!options.hideButtons)) {
			$(navLinks).css({display: ''});
			$([caption, number]).addClass("nav");
			if (options.hideCaption) $([caption, number]).css({display: 'none'});
			if (prevIndex >= 0) $(prevLink).fadeIn(options.captionFadeDuration);
			if (nextIndex >= 0) $(nextLink).fadeIn(options.captionFadeDuration);
		}

		// fade in		
		$(bottomContainer).css({opacity: ""}).fadeIn(options.captionFadeDuration);
		$(bottom).css("marginTop", -bottom.offsetHeight).animate({marginTop: 0}, options.captionFadeDuration);
	}
	
	function position(x, y) {
		$([center, bottomContainer]).css({left: x+'px', top: y+'px'});
	}

	/*
		Stops all animation and resets the box to a clear state
		Called by close() and change()
	*/
	function stop() {
		// reset everything to init state
		busy = true;
		$(center).removeClass();
		if (imageObj != null) { imageObj.onload = imageObj.onerror = null; imageObj = null; }
		if (ajaxReq != null) { ajaxReq.abort(); ajaxReq = null; }		
		if (slideshowTimeout != null) {clearTimeout(slideshowTimeout); slideshowTimeout = null; }
		if (busyTimeout != null) {clearTimeout(busyTimeout); busyTimeout = null; }
		if (closeTimeout != null) {clearTimeout(closeTimeout); closeTimeout = null; }
		if (inlineObj != null) {
			// put inline object back to it's place
			$(inlineParent).append($(inlineObj).css({display: inlineDisplay}));
			inlineObj = inlineParent = inlineDisplay = null;
		}
		videoWidescreen = loadError = false;
		resourceWidth = resourceHeight = 0;
		$(container).empty();
		$([center, bottom]).stop(true);
		$([navLinks, caption, number]).css({display: 'none'});
		$([caption, number]).removeClass().html("");
		$([container, bottomContainer, prevLink, nextLink]).stop(true).css({display: "none"});
	}
	
	function toggleSlide() {
		slideshowOff = (!slideshowOff);
		slideshowDirection = false;
		$(slideLink).toggleClass('disabled', slideshowOff);
		if (!slideshowOff) {
			setTimers();
		} else {
			if (slideshowTimeout != null) {clearTimeout(slideshowTimeout); slideshowTimeout = null; }
		}

		return false;
	}

	/*
		Closes the box
	*/
	function close(a) {
		if ((options.noClose) && (a != 1))
			return;

		if (activeIndex >= 0) {
			stop();
			activeIndex = prevIndex = nextIndex = -1;
			slideshowDirection = slideshowOff = false;
			
			// resize center
			$(overlay).stop().fadeOut(options.fadeDuration, setup);
			$(center).animate({height: options.closeHeight, marginTop: -options.closeHeight/2, width: options.closeWidth, marginLeft: -options.closeWidth/2, opacity: 0}, options.fadeDuration, function() {
				dragStop();
				$([center, bottomContainer, prevLink, nextLink]).css({left: '', top: ''});
				$(center).hide();
			});
		}

		return false;
	}
	
	/*
		Wrapper for autoclose function
	*/
	function autoClose() {
		close(1);
	}
	
	/*
		Set busy to false
	*/
	function notBusy() {
		busy = false;
	}
	
	/*
		Link validation functions
	*/
	
	/* returns true if the link is an image */
	function imageLink() {
		return /(\.jpg|\.jpeg|\.png|\.gif)$/i.test(resources[activeIndex][0]);
	}
	
	/* returns the youtube id if active link is a youtube link */
	function youtubeLink() {
		var r = /^http\:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9\-_]*)(&(.*))?$/i.exec(resources[activeIndex][0]);
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
	
	/*
		Preload functions
		Call animateBox() after preloading
	*/
	function preloadImage() {
		$(center).addClass("easyLoading");
		imageObj = new Image();
		imageObj.onload = function() {
			resourceWidth = this.width;
			resourceHeight = this.height;
			$(center).removeClass("easyLoading");
			animateBox();
		};
		imageObj.onerror = function() {
			loadError = true;
			animateBox();
		}
		imageObj.src = resources[activeIndex][0];
	}
	
	/* preload ajax; s(ervice) = 0(yt.com),1(vimeo.com) */
	function preloadAjax(s, id) {
		var url, params;
		$(center).addClass("easyLoading");
		params = {
			type: 'GET',
			dataType: 'jsonp',
			timeout: 2000,
			error: function(x, t) {
				if (t != "abort") {
					loadError = true;
					$(center).removeClass("easyLoading");
					animateBox();
				}
			}};

		if (s == 0) {
			url = 'http://gdata.youtube.com/feeds/api/videos/'+id+'?v=2&alt=jsonc';
			params.success = function(r) {
					if ((!r.error) && (r.data) && (r.data.accessControl.embed == "allowed"))
						videoWidescreen = (r.data.aspectRatio == "widescreen");
					else
						loadError = true;
					$(center).removeClass("easyLoading");
					animateBox();
				};
		} else if (s == 1) {
			url = 'http://vimeo.com/api/v2/video/'+id+'.json';
			params.success = function(r) {
				if (r.length) {
					if ((r[0].embed_privacy == 'anywhere') || (r[0].embed_privacy == 'approved')) {
						resourceWidth = r[0].width || 0;
						resourceHeight = r[0].height || 0;
					} else {
						loadError = true;
					}
				}
				$(center).removeClass("easyLoading");
				animateBox();
			};
		}
		ajaxReq = $.ajax(url, params);
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
	
	/*
		Drag and drop functions
	*/
	function dragStart(e) {
		if (options.dragDrop) {
			dragging = true;
			$([center, bottomContainer, prevLink, nextLink]).css({cursor: 'pointer'});
			dragOffX = e.pageX - $(this).position().left;
			dragOffY = e.pageY - $(this).position().top;
			return false;
		}
	}
	
	function dragMove(e) {
		if ((options.dragDrop) && (dragging))
			position(e.pageX - $(window).scrollLeft() - dragOffX,
			         e.pageY - $(window).scrollTop() - dragOffY);
	}
	
	function dragStop(e) {
		if (dragging) {
			dragging = false;
			$([center, bottomContainer, prevLink, nextLink]).css({cursor: ''});
		}
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
