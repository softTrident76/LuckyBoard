class roomInfoDlg extends Phaser.GameObjects.Sprite {
 
    constructor (scene, x, y)
    {
        super(scene, x, y);

        this.scene = scene;

        var confirm_back = scene.add.sprite(0.0, 0.0, '3pairs', 'alert_confirm');
        confirm_back.setOrigin(0.0, 1.0);
        this.confirm_back = confirm_back;        

		var confirm_cancel = scene.add.sprite(137.31442, -50.598694, 'ui', 'button-out');
		confirm_cancel.setOrigin(0.0, 0.0);
        confirm_cancel.setScale(0.8, 0.8);
        this.confirm_cancel = confirm_cancel;
		
		var confirm_okey = scene.add.sprite(46.2034, -50.598694, 'ui', 'button-out');
		confirm_okey.setOrigin(0.0, 0.0);
        confirm_okey.setScale(0.8, 0.8);
        this.confirm_okey = confirm_okey;

        var okey_text = scene.add.text(85.2034, -45.59, 'entrance', {fontSize: 12, color: '#fff', align: 'left', weight:'bold'});
        var cancel_text = scene.add.text(176.2034, -45.59, 'exit', {fontSize: 12, color: '#fff', align: 'left', weight:'bold'});
		
        this.parentContainer = scene.add.container(x, y);
        this.parentContainer.add(confirm_back);
        this.parentContainer.add(confirm_okey);
        this.parentContainer.add(confirm_cancel);
        this.parentContainer.add(okey_text);
        this.parentContainer.add(cancel_text);

        this.parentContainer.alpha = 0.0;
        this.parentContainer.setScale(0.1, 0.1);

        this.setButtonEvent();
    }

    setButtonEvent() {

        var _self = this;

        // okey button event //
        this.confirm_okey.setInteractive();		                        
        this.confirm_okey.setData('active', false); 
        this.confirm_okey.on('pointerover', function () {
            if (!this.getData('active'))
            {
                this.setFrame('button-over');
            }
        });
 
        this.confirm_okey.on('pointerout', function () {
            if (this.getData('active'))
            {
                this.setFrame('button-down');
            }
            else
            {
                this.setFrame('button-out');
            }
        });
 
        this.confirm_okey.on('pointerdown', function () {
            console.log('confirm okey');
        }, this);

        // cancel button event //
        this.confirm_cancel.setInteractive();		                        
        this.confirm_cancel.setData('active', false); 
        this.confirm_cancel.on('pointerover', function () {
            if (!this.getData('active'))
            {
                this.setFrame('button-over');
            }
        });
 
        this.confirm_cancel.on('pointerout', function () {
            if (this.getData('active'))
            {
                this.setFrame('button-down');
            }
            else
            {
                this.setFrame('button-out');
            }
        });
 
        this.confirm_cancel.on('pointerdown', function () {
            console.log('confirm cancel');
            _self.setVisible(false);
        }, this);

    }

    setVisible(bIsShow) {
        if( bIsShow ) {
            this.parentContainer.alpha = 0.0;
            this.parentContainer.setScale(0.1, 0.1);
            
            // create the container //
            var tween = this.scene.tweens.add({
                targets: this.parentContainer,
                scaleX: 1.0,
                scaleY: 1.0,
                alpha: 1.0,
                ease: 'Power1',
                duration: 500,
                yoyo: false,
                repeat: 0,
                onStart: function () { console.log('onStart'); console.log(arguments); },
                onComplete: function () { console.log('onComplete'); console.log(arguments); }
            });
        }
        else {
            this.parentContainer.alpha = 1.0;
            this.parentContainer.setScale(1.0, 1.0);
            
            // create the container //
            var tween = this.scene.tweens.add({
                targets: this.parentContainer,
                scaleX: 0.1,
                scaleY: 0.1,
                alpha: 0.0,
                ease: 'Power1',
                duration: 500,
                yoyo: false,
                repeat: 0,
                onStart: function () { console.log('onStart'); console.log(arguments); },
                onComplete: function () { console.log('onComplete'); console.log(arguments); }
            });
        }

        // this.parentContainer.list.forEach(sprite => {
        //     sprite.visible = bIsShow;
        // });
    }
}
