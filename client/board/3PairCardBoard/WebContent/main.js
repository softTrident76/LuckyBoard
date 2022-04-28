
window.addEventListener('load', function() {
	
	if (window.AudioContext || window.webkitAudioContext) {
    	var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	} else {
	    var audioCtx = null;
	}

	var game = new Phaser.Game({
        "title": "luckyboard | board",
        "width": 1366,
        "height": 768,
        "type": Phaser.AUTO,
        "backgroundColor": "#000",
        "parent": "board",
        scale: {
	        mode: Phaser.Scale.FIT,
	        parent: 'board',
	        autoCenter: Phaser.Scale.CENTER_BOTH,
	        width: 1366,
	        height: 768
	    },
	    dom: {
            createContainer: true,
        },
        audio: {
            context: audioCtx
        }
	});
	game.scene.add("Boot", Boot, true);
	
});

class Boot extends Phaser.Scene {

	preload() {
		this.load.pack("section1", "assets/pack.json");
	}

	create() {
		this.scene.start("board");
	}

}
