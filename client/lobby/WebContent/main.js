
window.addEventListener('load', function() {

	var game = new Phaser.Game({
        "title": "luckyboard | lobby",
        "width": 1600,
        "height": 768,
        "type": Phaser.AUTO,
        "parent": "lobby",
        physics: {
	        default: 'arcade',
	        arcade: {
	            debug: true
	        }
	    },
        scale: {
	       	mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_VERTICALLY,
	        parent: 'lobby',
	        width: 1600,
	        height: 768
	    },
        "backgroundColor": "#fff"
	});
	game.scene.add("Boot", Boot, true);	
});

class Boot extends Phaser.Scene {

	preload() {
		this.load.pack("section1", "assets/pack.json");	
	}

	create() {
		this.scene.start("lobby");
	}

}
