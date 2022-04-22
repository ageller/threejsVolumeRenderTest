// This is a generated file! Please edit source .ksy file and use kaitai-struct-compiler to rebuild

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['kaitai-struct/KaitaiStream', './MyArrayBuffer'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('kaitai-struct/KaitaiStream'), require('./MyArrayBuffer'));
  } else {
    root.MeshFormat = factory(root.KaitaiStream, root.MyArrayBuffer);
  }
}(this, function (KaitaiStream, MyArrayBuffer) {
var MeshFormat = (function() {
  function MeshFormat(_io, _parent, _root) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;

    this._read();
  }
  MeshFormat.prototype._read = function() {
    this.meshHeader = new Header(this._io, this, this._root);
    this.meshFieldDataFlat = new VectorField(this._io, this, this._root, "f4");
  }

  var Header = MeshFormat.Header = (function() {
    function Header(_io, _parent, _root) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root || this;

      this._read();
    }
    Header.prototype._read = function() {
      this.headerSize = this._io.readU4le();
      this.ncells = this._io.readU4le();
      this._raw_sizeDimensions = this._io.readBytes((4 * 3));
      var _io__raw_sizeDimensions = new KaitaiStream(this._raw_sizeDimensions);
      this.sizeDimensions = new MyArrayBuffer(_io__raw_sizeDimensions, this, null, "u4");
    }

    /**
     * total number of cells in the dataset
     */

    /**
     * array of ints for number of cells in each of x,y,z dimensions
     */

    return Header;
  })();

  var VectorField = MeshFormat.VectorField = (function() {
    function VectorField(_io, _parent, _root, fieldType) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root || this;
      this.fieldType = fieldType;

      this._read();
    }
    VectorField.prototype._read = function() {
      this.flatVectorData = new Field(this._io, this, this._root, this.fieldType, 3);
    }

    return VectorField;
  })();

  var Field = MeshFormat.Field = (function() {
    function Field(_io, _parent, _root, fieldType, components) {
      this._io = _io;
      this._parent = _parent;
      this._root = _root || this;
      this.fieldType = fieldType;
      this.components = components;

      this._read();
    }
    Field.prototype._read = function() {
      this._raw_data = this._io.readBytes((this._root.meshHeader.ncells * 4));
      var _io__raw_data = new KaitaiStream(this._raw_data);
      this.data = new MyArrayBuffer(_io__raw_data, this, null, this.fieldType);
    }

    return Field;
  })();

  return MeshFormat;
})();
return MeshFormat;
}));
