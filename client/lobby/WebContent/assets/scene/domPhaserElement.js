/**
 *
 */
function domPhaserElement (domElement, container) {
	eventPhaserDispatcher.call(this);
	
	this.container = container;
	this.domElement = domElement;	
	this.createDomElement(domElement, container);		
	document.addEventListener('onCanvasResize', this.updateDomElement.bind(this));
}

/** @type eventDispatcher */
var domPhaserElement_proto = Object.create(eventPhaserDispatcher.prototype);
domPhaserElement.prototype = domPhaserElement_proto;
domPhaserElement.prototype.constructor = domPhaserElement;

domPhaserElement.prototype.getBoundingClientRect = function() {
	var stage = document.getElementsByTagName('canvas')[0];
	var stage_bound_rect = stage.getBoundingClientRect();
	
	//var stage_bound_rect = {width: window.innerWidth, height: window.innerHeight};
	return stage_bound_rect;
}

domPhaserElement.prototype.getScaleRate = function() {
	var stage_bound_rect = this.getBoundingClientRect();
	var stage_scale_x = stage_bound_rect.width / 1366.0;
	var stage_scale_y = stage_bound_rect.height / 768.0;
	
	return { x: stage_scale_x, y: stage_scale_y };
}

domPhaserElement.prototype.createDomElement = function(domElement, container) {

	var stage_bound_rect = this.getBoundingClientRect();
	var scale_rate_vector = this.getScaleRate();
	
    domElement.style.textAlign = 'left';
    domElement.style.position = 'absolute';
    domElement.style.display = 'flex';
    domElement.style.alignContent = 'stretch';
	    
    domElement.style.left = stage_bound_rect.left + parseInt(container.x * scale_rate_vector.x) + 'px';
    domElement.style.top = stage_bound_rect.top + parseInt(container.y * scale_rate_vector.y) + 'px';        
    console.log(parseInt(container.x * scale_rate_vector.x) );
    console.log(parseInt(container.y * scale_rate_vector.y) );
        
    domElement.style.width = parseInt(container.width * container.scaleX ) + 'px';
    domElement.style.height = parseInt(container.height* container.scaleY ) + 'px';
      
    window.document.body.appendChild(domElement);
    
    console.log(scale_rate_vector);
    
    domElement.style.transformOrigin = '0% 0%';
	domElement.style.transform = `matrix(${scale_rate_vector.x}, 0, 0, ${scale_rate_vector.y}, 0,0)`;	
	
}

domPhaserElement.prototype.getDomElement = function() {
	return this.domElement;
}

domPhaserElement.prototype.updateDomElement = function() {

	var stage_bound_rect = this.getBoundingClientRect();
	var scale_rate_vector = this.getScaleRate();
	
	console.log(stage_bound_rect);
	
	var domElement = this.domElement;
	var container = this.container;
	
	var stage_bound_rect = this.getBoundingClientRect();
	var scale_rate_vector = this.getScaleRate();
	    
    domElement.style.left = stage_bound_rect.left + parseInt(container.x * scale_rate_vector.x) + 'px';
    domElement.style.top = stage_bound_rect.top + parseInt(container.y * scale_rate_vector.y) + 'px';        
        
    domElement.style.width = parseInt(container.width * container.scaleX ) + 'px';
    domElement.style.height = parseInt(container.height* container.scaleY ) + 'px';    

    domElement.style.transformOrigin = '0% 0%';
	domElement.style.transform = `matrix(${scale_rate_vector.x}, 0, 0, ${scale_rate_vector.y}, 0,0)`;
	
}

domPhaserElement.prototype.getContainer = function() {
	return this.container;
}

domPhaserElement.prototype.removeDomElement = function(domElement) {    
    domElement.remove();
}



