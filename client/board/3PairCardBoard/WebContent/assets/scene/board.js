
// You can write more code here

/* START OF COMPILED CODE */

class board extends Phaser.Scene {
	
	constructor() {
	
		super('board');
		
	}
	
	_create() {
	
		var background = this.add.image(0.0, 0.0, 'background');
		background.setOrigin(0.0, 0.0);
		
		var winBackImage = this.add.image(683.0, 350.0, 'images', 'win');
		winBackImage.visible = false;
		
		var loseBackImage = this.add.image(683.0, 350.0, 'images', 'lose');
		loseBackImage.visible = false;
		
		var winImage = this.add.sprite(683.0, 350.0, 'images', 'win');
		winImage.anims.play('win');
		
		var loseImage = this.add.sprite(688.0, 352.0, 'images', 'lose');
		loseImage.anims.play('lose');
		
		var clockimage = this.add.image(0.0, 0.0, 'images', 'clock');
			
		
		this.fBackground = background;
		this.fWinBackImage = winBackImage;
		this.fLoseBackImage = loseBackImage;
		this.fWinImage = winImage;
		this.fLoseImage = loseImage;
		this.fClockimage = clockimage;
	
	}
	
	/* START-USER-CODE */

	create() {
		this._create();	
		
		this.fWinImage.visible = false;
		this.fLoseImage.visible = false;
		
		this.fWinImage.anims.pause();
		this.fLoseImage.anims.pause();
		
		// clock image //
		this.fClock = this.add.container(0, 0).setDepth(6).setVisible(false);
		this.fClock.add(this.fClockimage);
		this.fTimebarVal = this.add.graphics({ x: 0, y: 7.5 });
        this.fClock.add(this.fTimebarVal);
        this.fTimeText = this.add.bitmapText(0, -3, "freeJewelFont", '', 26).setOrigin(0.5, 0.5);
        this.fClock.add(this.fTimeText);
        
        // Add buttons needed for game play
        this.fGameReadyButton = this.add.image(683, 500, "images", "btn_ready").setInteractive().setVisible(false);
        this.fGameReadyButton .on("pointerdown", this.setReady.bind(this));
        
        // Invite Other Players
        this.fInviteButton = this.add.image(1290, 33, "images", "inviteButton").setInteractive().setVisible(false);
        this.fInviteButton.on('pointerdown', function (point) {
            this.setFrame("inviteButtonHover");
            // if (volumeState)
            //     playClickSound();
        });
        this.fInviteButton.on('pointerout', function () {
            this.setFrame("inviteButton");
        });
        this.fInviteButton.on('pointerup', this.showInviteModal.bind(this));
        
        // Request to join game
        this.fChallengeButton = this.add.image(1286, 565, "images", "btn_request").setInteractive().setVisible(false);
        this.fChallengeButton.on('pointerdown', this.joinRoom.bind(this), this);
        
        // Exit Button
        this.fExitButton = this.add.image(1286, 708, "images", "btn_exit").setInteractive();
        this.fExitButton.on("pointerdown", this.exitControl.bind(this));
        
        // Sound Button
        this.add.image(1286, 636, "images", "volume_play").setInteractive().on("pointerdown", this.volumeControl.bind(this));
       
       	//this.load.html('inviteForm', 'assets/template/invite_list.html');
        //this.add.dom(0, 0).createFromCache('inviteForm');
        //this.container.createFromCache('inviteForm');
        //this.createFromCache('inviteForm');
        //this.game.domContainer.cre
        
	}
	
	setReady() {
	}
	
	inviteButton() {
	}
	
	exitControl() {
	}
	
	volumeControl() {
	}
	
	joinRoom() {
	}
	
	showInviteModal() {
	}	
	
	update() {		
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
