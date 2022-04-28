
// You can write more code here

/* START OF COMPILED CODE */

class lobby extends Phaser.Scene {
	
	constructor() {
	
		super('lobby');
		
	}
	
	preload() {
	
		this.load.pack('section1', 'assets/pack.json');
		
	}
	
	_create() {
	
		var background = this.add.image(0.0, 0.0, 'background');
		background.setOrigin(0.0, 0.0);
		
		var user_info_panel = this.add.sprite(211.51807, 83.0157, 'lobby', 'position_director.png');
		user_info_panel.setOrigin(0.0, 0.0);
		user_info_panel.setScale(7.9643826, 2.8238187);
		
		var room_panel = this.add.sprite(603.93085, 318.94482, 'lobby', 'position_director.png');
		room_panel.setOrigin(0.0, 0.0);
		room_panel.setScale(12.564314, 6.1431675);
		
		var search_panel = this.add.sprite(856.0, 29.0, 'lobby', 'position_director.png');
		search_panel.setOrigin(0.0, 0.0);
		search_panel.setScale(12.5178, 2.273);
		
		this.fUser_info_panel = user_info_panel;
		this.fRoom_panel = room_panel;
		this.fSearch_panel = search_panel;
		
		
	}
	
	/* START-USER-CODE */
	create() {
		this._create();
				
		// step 1: user info //
		var c = document.createElement("div");
        c.id = 'user_panel';
        c.className = "user_panel";
       	var userPanelDiv = new domPhaserElement(c, this.fUser_info_panel);
       	$(userPanelDiv.domElement).load('assets/template/user_panel.html'); 
       	
       	// step 2: search //
       	var c = document.createElement("div");
       	c.id = 'search_panel';
       	c.className = 'seach_panel';
       	var seachPanelDiv = new domPhaserElement(c, this.fSearch_panel);
       	$(seachPanelDiv.domElement).load('assets/template/search_panel.html');
       	
       	// step 3: roomlist //
       	var c = document.createElement("div");
       	c.id = 'roomlist_panel';
       	c.className = 'roomlist_panel';
       	var roomlistPanelDiv = new domPhaserElement(c, this.fRoom_panel);
		
		var ul = $('<ul/>');       		
       	for( var i = 0; i < 100; i++ ) {
       		var li = $('<li/>');
       		li.load('assets/template/room_info.html');       
       		ul.append(li);		
       	}       	
       	$(roomlistPanelDiv.domElement).append(ul);
       	
	}
	
	setButtonEvent() {
        var _self = this;

        this.fBtn3Pair.setInteractive();		                                 
        this.fBtn3Pair.on('pointerdown', function () {
           console.log('3pair button click');
           _self.fBtn3Pair.setTint(0xff0000);
        }, this);
        this.fBtn3Pair.on('pointerout', function() {
        	_self.fBtn3Pair.clearTint();
        }, this);
        this.fBtn3Pair.on('pointerup', function() {
        	_self.fBtn3Pair.clearTint();
        }, this);
        
        this.fBtn4Pair.setInteractive();
        this.fBtn4Pair.on('pointerdown', function() {
        	console.log('4pair button click');
        	_self.fBtn4Pair.setTint(0xff0000);
        }, this);        
        this.fBtn4Pair.on('pointerout', function() {
        	_self.fBtn4Pair.clearTint();
        }, this);
        this.fBtn4Pair.on('pointerup', function() {
        	_self.fBtn4Pair.clearTint();
        }, this);
        
        this.fBtn5Pair.setInteractive();
        this.fBtn5Pair.on('pointerdown', function() {
        	console.log('5pair button click');        	
        	_self.fBtn5Pair.setTint(0xff0000);
        }, this);        
        this.fBtn5Pair.on('pointerout', function() {
        	_self.fBtn5Pair.clearTint();
        }, this);
        this.fBtn5Pair.on('pointerup', function() {
        	_self.fBtn5Pair.clearTint();
        }, this);
        
                
        this.fBtnCreate.setInteractive();
        this.fBtnCreate.on('pointerdown', function() {
        	console.log('create button click');
        	_self.fBtnCreate.setTint(0xff0000);
        }, this); 
        this.fBtnCreate.on('pointerout', function() {
        	_self.fBtnCreate.clearTint();
        }, this);
        this.fBtnCreate.on('pointerup', function() {
        	_self.fBtnCreate.clearTint();
        }, this);

    }
	
	
	/* END-step 1: move the hero  */
	
	update() {
	
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
