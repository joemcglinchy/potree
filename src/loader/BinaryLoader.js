
Potree.BinaryLoader = function(version, boundingBox, scale){
	if(typeof(version) === "string"){
		this.version = new Potree.Version(version);
	}else{
		this.version = version;
	}
	
	this.boundingBox = boundingBox;
	this.scale = scale;
};

Potree.BinaryLoader.prototype.load = function(node){
	if(node.loaded){
		return;
	}
	
	var scope = this;

	var url = node.getURL();
	
	if(this.version.equalOrHigher("1.4")){
		url += ".bin";
	}
	
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';
	xhr.overrideMimeType('text/plain; charset=x-user-defined');
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			if (xhr.status === 200 || xhr.status === 0) {
				var buffer = xhr.response;
				scope.parse(node, buffer);
			} else {
				console.log('Failed to load file! HTTP status: ' + xhr.status + ", file: " + url);
			}
		}
	};
	try{
		xhr.send(null);
	}catch(e){
		console.log("fehler beim laden der punktwolke: " + e);
	}
};

Potree.BinaryLoader.prototype.parse = function(node, buffer){

	var numPoints = buffer.byteLength / node.pcoGeometry.pointAttributes.byteSize;
	var pointAttributes = node.pcoGeometry.pointAttributes;
	
	
	var ww = Potree.workers.binaryDecoder.getWorker();
	ww.onmessage = function(e){
		var data = e.data;
		var buffers = data.attributeBuffers;
		
		Potree.workers.binaryDecoder.returnWorker(ww);
		
		var geometry = new THREE.BufferGeometry();
		
		for(var property in buffers){
			if(buffers.hasOwnProperty(property)){
				var buffer = buffers[property].buffer;
				var attribute = buffers[property].attribute;
				var numElements = attribute.numElements;
				
				if(parseInt(property) === PointAttributeNames.POSITION_CARTESIAN){
					geometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array(buffer), 3));
				}else if(parseInt(property) === PointAttributeNames.COLOR_PACKED){
					geometry.addAttribute("color", new THREE.BufferAttribute(new Float32Array(buffer), 3));
				}else if(parseInt(property) === PointAttributeNames.INTENSITY){
					geometry.addAttribute("intensity", new THREE.BufferAttribute(new Float32Array(buffer), 1));
				}else if(parseInt(property) === PointAttributeNames.CLASSIFICATION){
					geometry.addAttribute("classification", new THREE.BufferAttribute(new Float32Array(buffer), 1));
				}
			}
		}
		geometry.addAttribute("indices", new THREE.BufferAttribute(new Float32Array(data.indices), 1));
		
		geometry.boundingBox = node.boundingBox;
		node.geometry = geometry;
		node.loaded = true;
		node.loading = false;
		node.pcoGeometry.numNodesLoading--;
	}
	
	var message = {
		buffer: buffer,
		pointAttributes: pointAttributes,
		version: this.version.version,
		min: [ node.boundingBox.min.x, node.boundingBox.min.y, node.boundingBox.min.z ],
		offset: [node.pcoGeometry.offset.x, node.pcoGeometry.offset.y, node.pcoGeometry.offset.z],
		scale: this.scale
	};
	ww.postMessage(message, [message.buffer]);

};

