/*
	Easybox v1.4 - Lightweight easy to use lightbox clone for jQuery
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
	// Global options
	var defaults = {
		loop: false,                  // navigate between first and last image
		preloadNext: true,            // preloads previous and next resources if true
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
		initCenterSize: [250, 250],         // initial size of window
		errorSize: [320, 180],        // error container size
		defaultContentSize: [960, 720],
		maximumContentSize: [1280, 720],
		captionFadeDuration: 200,     // caption fade duration
		slideshow: 0,                 // slideshow interval; 0 = disable slideshows
		autoClose: 0,                 // close after x milliseconds; 0 = disable autoClose
		counterText: "{x} of {y}",    // counter text; {x} replaced with current image number; {y} replaced with total image count
		closeKeys: [27],              // array of keycodes to close easybox, default: Esc (27), 'x' (88), 'c' (67)
		previousKeys: [37],           // array of keycodes to navigate to the previous image, default: Left arrow (37), 'p' (80)
		nextKeys: [39],               // array of keycodes to navigate to the next image, default: Right arrow (39), 'n' (78)
		preventOtherKeys: true        // prevents handling of other keys
		};
	
	var resourceHandlers = [], options, resources, activeIndex = -1, prevIndex, nextIndex, centerSize,
	    hiddenElements = [], slideshowDirection, slideshowOff,
	// drag and drop vars
	    dragging = false, dragOffX = 0, dragOffY = 0,
	// state variables and timeouts
	    open = false, busy, shown, slideshowTimeout = null, closeTimeout = null,
	// DOM elements
	    overlay, center, container, navLinks, prevLink, nextLink, slideLink, closeLink, bottom, caption, number, loadingIndicator;

	/*
		Initialization
	*/
	$(function() {
		$("body").append(
			$([
				overlay = $('<div id="easyOverlay" />').click(userClose)[0],
				center = $('<div id="easyCenter" />').append([
					container = $('<div id="easyContainer" />')[0],
					loadingIndicator = $('<div id="easyLoadingIndicator" />')[0],
					bottom = $('<div id="easyBottom" />').append([
						navLinks = $('<div id="easyNavigation" />').append([
							prevLink = $('<a id="easyPrevLink" href="#" />').click(previous)[0],
							nextLink = $('<a id="easyNextLink" href="#" />').click(next)[0]
						])[0],
						closeLink = $('<a id="easyCloseLink" href="#" />').click(userClose)[0],
						slideLink = $('<a id="easySlideLink" href="#" />').click(toggleSlide)[0],
						caption = $('<div id="easyCaption" />')[0],
						number = $('<div id="easyNumber" />')[0]
					])[0]
				])[0]
			]).css("display", "none")
		);
		
		// iframe resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				return (r.url) ? true : false;
			},
			postLoad: function(r) {
				r.obj = $("<iframe width=\""+r.width+"\" height=\""+r.height+"\" src=\""+r.url+"\" frameborder=\"0\"></iframe>")[0];
			}		});
		
		// html resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				return (r.html) ? true : false;
			},
			postLoad: function(r) {
				r.obj = $('<div style="width:'+r.width+'px;height:'+r.height+'px">'+r.html+'</div>')[0];
			}
		});
		
		// inline resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				var res = /^(.*)\#([A-Za-z0-9\-_]*)$/i.exec(r.url);
				if ((res != null) && ($('#'+res[2]).length)) {
					r.id = res[2];
					return true;
				}
				return false;
			},
			preLoad: function(r, loaded) {
				var o = $('#'+r.id)[0];
				if (o) {
				      r.width = r.width || $(o).width();
				      r.height = r.height || $(o).height();
				      r.obj = o;
				} else {
				      r.error = true;
				}
				loaded();
			},
			postLoad: function(r) {
				r.parent = $(r.obj).parent()[0];
				r.display = $(r.obj).css('display');
			},
			show: function(r) {
				$(r.obj).css('display', 'block');
			},
			hide: function(r) {
				$(r.parent).append($(r.obj).css('display', r.display));
			}
		});
		
		// image resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				return /(\.jpg|\.jpeg|\.png|\.gif)$/i.test(r.url);
			},
			preLoad: function(r, loaded) {
				var obj = new Image();
				obj.onload = function() {
					r.width = r.width || this.width;
					r.height = r.height || this.height;
					loaded();
				};
				obj.onerror = function() {
					r.error = true;
					loaded();
				}
				obj.src = r.url;
			},
			postLoad: function(r) {
				r.obj = $("<img src=\""+r.url+"\" style=\"display:block;width:"+r.width+"px;height:"+r.height+"px\" alt=\""+r.caption+"\" />")[0];
			}
		});
		
		// video resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				return /(\.mpg|\.mpeg|\.mp4|\.ogv|\.webm|\.flv)$/i.test(r.url);
			},
			postLoad: function(r) {
				r.obj = $('<div style="overflow:hidden;width:'+r.width+'px;height:'+r.height+'px" />')[0];
			},

			show: function(r) {
				// check for flowplayer
				var p = (!!$.fn.flowplayer);

				$(r.obj).append($("<video src=\""+r.url+"\" width=\""+r.width+"\" height=\""+r.height+"\""+(!p ? " controls=\"controls\"" : "")+" />"));

				if (p)
					$(r.obj).flowplayer();
			}
		});
		
		// youtube video resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				var res = /^http\:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9\-_]*)(&(.*))?$/i.exec(r.url);
				if (res != null) {
					r.id = res[1];
					return true;
				}
				return false;
			},
			preLoad: function(r, loaded) {
				var params = {
					type: 'GET',
					dataType: 'jsonp',
					timeout: 2000,
					error: function(x, t) {
						if (t != "abort") {
							r.error = true;
							loaded();
						}
					},
					success: function(s) {
						if ((!s.error) && (s.data) && (s.data.accessControl.embed == "allowed")) {
							var w = (s.data.aspectRatio == "widescreen");
							r.height = r.height || 720;
							r.width = Math.round(r.height*((w) ? (16.0/9.0) : (4.0/3.0)));
						} else
							r.error = true;
						loaded();
					}};
				$.ajax('http://gdata.youtube.com/feeds/api/videos/'+r.id+'?v=2&alt=jsonc', params);
			},
			postLoad: function(r) {
				var p = '?version=3&autohide=1&autoplay=1&rel=0'; // params
				//if ((options.ytPlayerTheme) && ((t = /^([a-z]*),([a-z]*)$/.exec(options.ytPlayerTheme)) != null))
				//	p += '&theme='+t[1]+'&color='+t[2];
				r.obj = $("<iframe src=\"http://www.youtube.com/embed/"+r.id+p+"\" width=\""+r.width+"\" height=\""+r.height+"\" frameborder=\"0\"></iframe>")[0];
			}
		});
		
		// vimeo video resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				var res =  /^http\:\/\/vimeo\.com\/([0-9]*)(.*)?$/i.exec(r.url);
				if (res != null) {
					r.id = res[1];
					return true;
				}
				return false;
			},
			preLoad: function(r, loaded) {
				var params = {
					type: 'GET',
					dataType: 'jsonp',
					timeout: 2000,
					error: function(x, t) {
						if (t != "abort") {
							r.error = true;
							loaded();
						}
					},
					success: function(s) {
						if (s.length) {
							if ((s[0].embed_privacy == 'anywhere') || (s[0].embed_privacy == 'approved')) {
								if ((s[0].width) && (s[0].height)) {
									r.width = s[0].width;
									r.height = s[0].height;
								}
							} else {
								r.error = true;
							}
						}
						loaded();
					}};
				$.ajax('http://vimeo.com/api/v2/video/'+r.id+'.json', params);
			},
			postLoad: function(r) {
				var p = '?title=0&byline=0&portrait=0&autoplay=true';
				r.obj = $("<iframe src=\"http://player.vimeo.com/video/"+r.id+p+"\" width=\""+r.width+"\" height=\""+r.height+"\" frameborder=\"0\"></iframe>")[0];
			}
		});
		
		// dailymotion video resource handler
		$.easybox.resourceHandler({
			identify: function(r) {
				if (!r.url) return false;
				var res =  /^http\:\/\/www\.dailymotion\.com\/video\/([A-Za-z0-9]*)(.*)?$/i.exec(r.url);
				if (res != null) {
					r.id = res[1];
					return true;
				}
				return false;
			},
			preLoad: function(r, loaded) {
				var params = {
					type: 'GET',
					dataType: 'jsonp',
					timeout: 2000,
					error: function(x, t) {
						if (t != "abort") {
							r.error = true;
							loaded();
						}
					},
					success: function(s) {
						if (s.allow_embed) {
							var q = s.aspect_ratio;
							r.height = r.height || 720;
							r.width = Math.round(r.height*q);
						} else {
							r.error = true;
						}
						loaded();
					}};
				$.ajax('https://api.dailymotion.com/video/'+r.id+'?fields=allow_embed,aspect_ratio', params);
			},
			postLoad: function(r) {
				var p = '?autoplay=1';
				r.obj = $("<iframe src=\"http://www.dailymotion.com/embed/video/"+r.id+p+"\" width=\""+r.width+"\" height=\""+r.height+"\" frameborder=\"0\"></iframe>")[0];
			}
		});
	});


	/*
		options:        Optional options object given to $.easybox function
		linkMapper:     Optional function taking a link DOM element and an index as arguments and returning an array containing 2 elements:
		                the image URL and the image caption (may contain HTML)
		linksFilter:    Optional function taking a link DOM element and an index as arguments and returning true if the element is part of
		                the image collection that will be shown on click, false if not. "this" refers to the element that was clicked.
		                This function must always return true when the DOM element argument is "this".
		                This function must not return true when the rel tags of the DOM element and *this* are not equal.
		dynamicoptions: Optional function taking a link DOM element and returns an options object which is then added to the objects object
		                passed as first parameter and then passed to EasyBox.
	*/
	$.fn.easybox = function(_options, linkMapper, linksFilter, dynamicOptions) {
		linkMapper = linkMapper || function(el) {
			var obj = {url: el.href, caption: el.title};
			if (el.hasAttribute("data-width")) obj.width = el.getAttribute("data-width");
			if (el.hasAttribute("data-height")) obj.height = el.getAttribute("data-height");
			return obj;
		};

		linksFilter = linksFilter || function(el) {
			return (this == el);
		};
		
		dynamicOptions = dynamicOptions || function(link) {
			return {};
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

			return $.easybox(filteredLinks, startIndex, $.extend({}, _options, dynamicOptions(link)));
		});
	};

	/*
		API
		Opens easybox with the specified parameters
	*/
	$.easybox = function(_resources, startIndex, _options) {
		if (open)
			return false;

		// complete options
		options = $.extend({}, defaults, _options);

		// fill resources array
		var i = 0, len;
		resources = [];
		for (len = _resources.length; i < len; ++i) {
			resources.push($.extend({caption: "", width: 0, height: 0},
						_resources[i], {handler: null, loaded: false, loading: false, error: false, obj: null}));
		}
		
		if (!resources.length)
			return;
		open = true;
		
		// set loop option
		options.loop = ((options.loop) && (resources.length > 1));
		options.slideshow = ((options.slideshow) && (resources.length > 1)) ? options.slideshow : 0;
		
		// show slideshow button if slideshow and not disabled
		$(slideLink).removeClass('disabled').css({display: (((options.slideshow) && (resources.length > 1) && (!options.hideButtons)) ? '' : 'none')});
		slideshowDirection = slideshowOff = false;
		// show close button if not disabled
		$(closeLink).css({display: ((!options.hideButtons) ? '' : 'none')})

		// initializing center
		centerSize = options.initCenterSize.slice();

		stop();
		setup(1);

		$(center).show();
		$(overlay).css({opacity: options.overlayOpacity}).fadeIn(options.fadeDuration, function() {
			change(Math.min(resources.length-1, startIndex || 0));
		});

		return false;
	};

	/*
		Jump to previous resource
		Returns true if successful, false otherwise
	*/
	$.easybox.previous = function() { return (prevIndex >= 0) ? !previous() : false };

	/*
		Jump to next resource
		Returns true if successful, false otherwise
	*/
	$.easybox.next = function() { return (nextIndex >= 0) ? !next() : false };

	/*
		Close EasyBox
		Returns true if close, false otherwise
	*/
	$.easybox.close = function() { return (open) ? !close() : false };

	/*
		Returns true if EasyBox is open, false otherwise
	*/
	$.easybox.isOpen = function() { return open; };

	/*
		Change default options
	*/
	$.easybox.defaults = function(def) { defaults = $.extend(defaults, def); }
	
	/*
		Add a resource handler
		
		handler: Resource handler object
	*/
	$.easybox.resourceHandler = function(handler) {
		resourceHandlers.push($.extend({
			identify: function() { return false; },
			preLoad: function(resource, loaded) { loaded(); },
			postLoad: function() {},
			abort: function() {},
			show: function() {},
			hide: function() {}
		}, handler));
	};
	
	/*
		Change resource
	*/
	function change(index) {
		if ((busy) || (index < 0) || (index >= resources.length))
			return false;

		// reset everything
		stop();
		
		activeIndex = index;
		prevIndex = (activeIndex || (options.loop ? resources.length : 0)) - 1;
		nextIndex = ((activeIndex + 1) % resources.length) || (options.loop ? 0 : -1);
		
		if (options.preloadNext) {
			if (prevIndex >= 0)
				load(resources[prevIndex]);
			if (nextIndex >= 0)
				load(resources[nextIndex]);
		}

		if (!resources[activeIndex].loaded)
			$(loadingIndicator).show();
		load(resources[activeIndex]);
		return false;
	}
	
	/*
		Animates the box
		Called by change()
	*/
	function animateBox() {
		var r = resources[activeIndex];
		$(loadingIndicator).hide();

		if (!r.error) {
			// set caption
			if ((!options.hideCaption) && (r.caption.length))
				$(caption).html(r.caption).css({display: ''});
			// resize container
			$(container).width(r.width).height(r.height);
		} else {
			// error class and sizing
			$(container).addClass("error").width(options.errorSize[0]).height(options.errorSize[1]);
		}
		
		// set number text
		if ((!options.hideCaption) && (resources.length > 1) && (options.counterText.length))
			$(number).html(options.counterText.replace(/{x}/, activeIndex + 1).replace(/{y}/, resources.length)).css({display: ''});

		// retrieve center dimensions
		busy = true;
		$(container).css({visibility: "hidden", display: ""});
		animateCenter([container.offsetWidth, container.offsetHeight], -1, options.resizeDuration);

		// gets executed after animation effect
		$(center).queue(function(next) {
			$(container).css({visibility: "", display: "none"});
			if (!r.error) {
				$(r.obj).appendTo(container);
				r.handler.show(r);
				shown = true;
			}
			setTimers();
			$(container).fadeIn(options.fadeDuration, animateCaption);
			busy = false;
			next();
		});
	}
	
	function animateCenter(size, opacity, duration) {
		centerSize = size.slice();
		var p = {};
		
		// resize center
		if ((center.offsetHeight != size[1]) || (center.offsetWidth != size[0]))
			p = {height: size[1], marginTop: -size[1]/2, width: size[0], marginLeft: -size[0]/2};
		if (opacity > -1)
			p.opacity = opacity;
		$(center).animate(p, duration, options.resizeEasing);
	}

	/*
		Animates the caption
		Called by animateBox() when finished
	*/
	function animateCaption() {
		if (options.hideBottom)
			return;

		if (((prevIndex >= 0) || (nextIndex >= 0)) && (!options.noNavigation) && (!options.hideButtons)) {
			$(navLinks).css({display: ''});
			$([caption, number]).addClass("nav");
			if (prevIndex < 0) $(prevLink).addClass("disabled");
			if (nextIndex < 0) $(nextLink).addClass("disabled");
		}
		
		// fade in
		$(bottom).fadeIn(options.captionFadeDuration);
		$(center).animate({height: centerSize[1]+bottom.offsetHeight}, options.captionFadeDuration, options.resizeEasing);
	}
	
	/*
		Stops all animation and resets the box to a clear state
		Called by close() and change()
	*/
	function stop() {
		// reset timers
		if (slideshowTimeout != null) {clearTimeout(slideshowTimeout); slideshowTimeout = null; }
		if (closeTimeout != null) {clearTimeout(closeTimeout); closeTimeout = null; }
		
		if (activeIndex >= 0) {
			var r = resources[activeIndex];
			if ((!r.error) && (shown))
				r.handler.hide(r);
		}
		
		// reset everything
		$([container, caption, number]).html("");
		$(loadingIndicator).hide();
		$([bottom, container]).stop(true, true).hide();
		$(center).stop(true).css({width: centerSize[0], height: centerSize[1], marginLeft: -centerSize[0]/2, marginTop: -centerSize[1]/2, opacity: ""});
		$([navLinks, caption, number]).hide();
		$([container, caption, number, prevLink, nextLink]).removeClass();
		shown = busy = false;
	}
	
	/*
		Closes the box
	*/
	function close() {
		if (!open)
			return false;

		stop();
		activeIndex = prevIndex = nextIndex = -1;
		dragStop();
		setup(0);
		
		// abort loading progress
		for (var i = 0; i < resources.length; ++i) {
			var r = resources[i];
			if ((!r.loaded) && (r.loading))
				r.handler.abort(r);
		}
		
		// resize center
		$(overlay).stop().fadeOut(options.fadeDuration);
		animateCenter([centerSize[0]/2, centerSize[1]/2], 0, options.fadeDuration);
		$(center).queue(function(next) {
			$(center).css({left: '', top: ''}).hide();
			open = false;
			next();
		});

		return false;
	}

	/*
		USER ACTIONS
	*/

	function previous() {
		slideshowDirection = true;	// backwards
		return change(prevIndex);
	}

	function next() {
		slideshowDirection = false;	// forwards
		return change(nextIndex);
	}
	
	function userClose() {
		if ((busy) || (options.noClose)) return false;
		return close();
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
		TIMERS
	*/
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
			closeTimeout = setTimeout(close, options.autoClose);
		return false;
	}
	
	/*
		Loading routines
	*/
	
	function load(r) {
		if (r.loaded)
			loaded(r);
		if (r.loading)
			return;
		r.loading = true;
		
		for (var i = resourceHandlers.length-1; i >= 0; --i) {
			if (resourceHandlers[i].identify(r)) {
				r.handler = resourceHandlers[i];
				r.handler.preLoad(r, function() { loaded(r) });
				return;
			}
		}
		
		r.error = true;
		loaded(r);
	}
	
	function loaded(r) {
		if (!r.loaded) {
			r.loaded = true;
			
			if (!r.error) {
				// fallback to default content size
				if ((!r.width) || (!r.height)) {
					r.width = options.defaultContentSize[0];
					r.height = options.defaultContentSize[1];
				}
				
				// shrink
				//TODO: optimize
				if (r.height > options.maximumContentSize[1]) { r.width = Math.round(options.maximumContentSize[1]*r.width/r.height); r.height = options.maximumContentSize[1]; }
				if (r.width > options.maximumContentSize[0]) { r.height = Math.round(options.maximumContentSize[0]/r.width*r.height); r.width = options.maximumContentSize[0]; }
				
				r.handler.postLoad(r);
			}
		}

		if (resources[activeIndex] == r)
			animateBox();
	}
	
	/*
		Event functionality
	*/
	
	/*
		Setup and unsetup method
		Hide/unhide flash elements, bind/unbind events
	*/
	function setup(o) {
		if (o) {
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

		var fn = o ? "bind" : "unbind";
		
		// key handling
		$(document)[fn]("keydown", keyDown);

		// mousewheel functionality
		if ($.fn.mousewheel)
			$(window)[fn]('mousewheel', mouseWheel);

		// drag and drop functionality
		$(center)[fn]("mousedown", dragStart)[fn]("mousemove", dragMove)[fn]("mouseup", dragStop);
		$(window)[fn]('mousemove', dragMove)[fn]("mouseup", dragStop);
	}

	/*
		Key handling function
	*/
	function keyDown(event) {
		var code = event.keyCode, fn = $.inArray;
		// Prevent default keyboard action (like navigating inside the page)
		return (fn(code, options.closeKeys) >= 0) ? userClose()
			: ((fn(code, options.nextKeys) >= 0) && (!options.noNavigation)) ? next()
			: ((fn(code, options.previousKeys) >= 0) && (!options.noNavigation)) ? previous()
			: (!options.preventOtherKeys);
	}

	/*
		Mouse wheel handling function
	*/
	function mouseWheel(event, delta) {
		return ((delta > 0) && (!options.noNavigation)) ? previous()
			: ((delta < 0) && (!options.noNavigation)) ? next()
			: false;
	}
	
	/*
		Drag and drop functions
	*/
	
	function dragStart(e) {
		if (options.dragDrop) {
			dragging = true;
			$(center).css({cursor: 'pointer'});
			dragOffX = e.pageX - $(this).position().left;
			dragOffY = e.pageY - $(this).position().top;
			return false;
		}
		return true;
	}
	
	function dragMove(e) {
		if ((options.dragDrop) && (dragging)) {
			position(e.pageX - $(window).scrollLeft() - dragOffX,
			         e.pageY - $(window).scrollTop() - dragOffY);
			return false;
		}
		return true;
	}
	
	function dragStop(e) {
		if (dragging) {
			dragging = false;
			$(center).css({cursor: ''});
		}
		return true;
	}

	function position(x, y) {
		$(center).css({left: x+'px', top: y+'px'});
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
