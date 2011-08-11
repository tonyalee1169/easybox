// AUTOLOAD CODE BLOCK (MAY BE CHANGED OR REMOVED)
if (!/android|iphone|ipod|series60|symbian|windows ce|blackberry|msie 6/i.test(navigator.userAgent)) {
	jQuery(function($) {
		$("a[rel^='lightbox']").easybox({/* Put custom options here */}, null, function(el) {
			return (this == el) || ((this.rel.length > 8) && (this.rel == el.rel));
		});
		$("a[rel^='slideshow']").easybox({slideshow: 5000}, null, function(el) {
			return (this == el) || ((this.rel.length > 9) && (this.rel == el.rel));
		});
	});
}
