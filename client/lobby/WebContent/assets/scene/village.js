
// You can write more code here

/* START OF COMPILED CODE */
class village extends Phaser.Scene {
	
	constructor() {
	
		super('village');
		
	}
	
	preload() {
	
		this.load.pack('section1', 'assets/pack.json');
		
	}

	init() {
	}
	
	_create() {
	
		var background = this.add.image(0.0, 0.0, 'background');
		background.setOrigin(0.0, 0.0);
		
		var hero = this.add.sprite(267.85718, 317.45746, '3pairs', 'rwalk_00');
		hero.active = false;
		hero.anims.play('walking_right');
		
		var house = this.add.sprite(529.3698, 479.02118, '3pairs', 'house');
		house.setOrigin(0.0, 0.5);
		
		this.fHero = hero;
		this.fHouse = house;
		
	}
	
	/* START-USER-CODE */
	create() {

		// fade the scene for initial display //
		this.cameras.main.fadeFrom(1000, 0, 0, 0);
		this.cameras.main.on('camerafadeoutcomplete', function () { 
            this.scene.restart();
		}, this);
		
		// display init //
		var _self = this;
		this._create();
		
		// var roomInfoDlg = this.add.roomInfoDlg(this.scene, 200, 200);			
		// let sprite = new roomInfoDlg(this.scene, 200, 200);
		var roomInfo = new roomInfoDlg(this, 200, 200);
		this.children.add(roomInfo);
		this.fRoomInfo = roomInfo;
		console.log(roomInfo);

		// hero initialize //
		this.move_hero_step = {x: 1, y: 1};
		this.move_hero_position = null;
		this.move_hero_direction = null;
		this.fHero.active = true;
		this.fHero.anims.stop();
		this.fHero.setData('move', false);

		// create the collide the physics //
		var hero_collide = this.physics.add.existing(this.fHero);
		var house_collide = this.physics.add.existing(this.fHouse);
		this.physics.add.overlap(hero_collide, house_collide, this.hero_visit_house, null, this);

		// mouse event add //
		this.input.on('pointerdown',
		function (pointer, gameobject) {
			// get the mouse position //
			if( !gameobject || gameobject.length == 0) {
				_self.move_hero_position = {x: pointer.x, y: pointer.y};
				_self.fHero.setData('move', true);
			}	
	    }, this);
	}
	
	/**
	 * step 1: move the hero 
	 */
	// step 1.1: check horizontal direction //
	is_should_go_horizon(sprite, position) {
		var x_step = this.move_hero_step.x, y_step = this.move_hero_step.y;
		if( sprite.x < position.x - x_step  ) return 'right';
		else if( sprite.x > position.x + x_step ) return 'left';
		else return '';
	}

	// step 1.2: check vertical direction //
	is_should_go_vertical(sprite, position) {
		var x_step = this.move_hero_step.x, y_step = this.move_hero_step.y;
		if( sprite.y < position.y - y_step  ) return 'down';
		else if( sprite.y > position.y + y_step )  return 'up';
		else return '';
	}

	// step 1.3: move the hero //
	move_hero(position) {
		
		if( position == null || position == undefined ) 
			return;
			
		var hero = this.fHero;
		var direction = null;

		if( ( direction = this.is_should_go_horizon(hero, position) ) != '' ) {
			console.log('horz: ' + direction);
			this.move_in_direction(hero, direction);
		}
		else if( ( direction = this.is_should_go_vertical(hero, position) ) != '' ) {
			console.log('vert: ' + direction);
			this.move_in_direction(hero, direction);
		}
		else {
			// stop the animation in moving the hero //
			this.move_hero_position = null;
			hero.anims.stop();
		}

		// when direction gets changed, replace the texture and the animation, for sprite //
		if( this.move_hero_direction != direction ) {
			switch(direction) {
				case 'left': 
					hero.setTexture('3pairs', 'lwalk_00');
					hero.setScale(1.0, 1.0);
					hero.anims.play('walking_left');	
				break;
				case 'right': 
					hero.setTexture('3pairs', 'rwalk_00');
					hero.setScale(1.0, 1.0);
					hero.anims.play('walking_right');	
				break;
				case 'down': 
					hero.setTexture('3pairs', 'dwalk_00');
					hero.setScale(1.0, 1.0);
					hero.anims.play('walking_down');	
				break;
				case 'up': 
					hero.setTexture('3pairs', 'uwalk_00');
					hero.setScale(1.0, 1.0);
					hero.anims.play('walking_up');
				break;
			}
			this.move_hero_direction = direction;
		}
	} 

	// step 1.4: move the hero in direction //
	move_in_direction(hero, direction) {
		var x_step = this.move_hero_step.x, y_step = this.move_hero_step.y;
		switch(direction) {
			case 'left': hero.x -= x_step; break;
			case 'right': hero.x += x_step; break;
			case 'down': hero.y += y_step; break;
			case 'up': hero.y -= y_step; break;
		}
	}

	move_in_redirection(hero, direction) {
		var x_step = this.move_hero_step.x, y_step = this.move_hero_step.y;
		switch(direction) {
			case 'left': hero.x += x_step * 2; break;
			case 'right': hero.x -= x_step * 2; break;
			case 'down': hero.y -= y_step * 2; break;
			case 'up': hero.y += y_step * 2; break;
		}
	}

	// step 1.5: when met the house, stop moving //
	hero_visit_house(hero, house) {
		console.log('hero_visit_house');

		// stop the animation in moving the hero //
		this.move_in_redirection(hero, this.move_hero_direction);
		hero.setData('move', false);
		hero.anims.stop();
		this.move_hero_position = null;

		this.fRoomInfo.parentContainer.x = hero.x;
		this.fRoomInfo.parentContainer.y = hero.y;
		this.fRoomInfo.setVisible(true);
	}

	/* END-step 1: move the hero  */
	
	update() {
		if(this.fHero.getData('move'))
			this.move_hero(this.move_hero_position);
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
