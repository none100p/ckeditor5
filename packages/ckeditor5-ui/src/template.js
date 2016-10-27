/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* global document */

import CKEditorError from '../utils/ckeditorerror.js';
import mix from '../utils/mix.js';
import EmitterMixin from '../utils/emittermixin.js';
import Collection from '../utils/collection.js';
import View from './view.js';
import ViewCollection from './viewcollection.js';
import cloneDeepWith from '../utils/lib/lodash/cloneDeepWith.js';
import isObject from '../utils/lib/lodash/isObject.js';

const xhtmlNs = 'http://www.w3.org/1999/xhtml';

/**
 * A basic Template class. It renders DOM HTMLElement or Text from {@link ui.TemplateDefinition} and supports
 * element attributes, children, bindings to {@link utils.Observable} instances and DOM events
 * propagation. For example:
 *
 *		new Template( {
 *			tag: 'p',
 *			attributes: {
 *				class: 'foo',
 *				style: {
 *					backgroundColor: 'yellow'
 *				}
 *			},
 *			children: [
 *				'A paragraph.'
 *			]
 *		} ).render();
 *
 * will render the following HTMLElement:
 *
 *		<p class="foo" style="background-color: yellow;">A paragraph.</p>
 *
 * See {@link ui.TemplateDefinition} to know more about templates and complex template definitions.
 *
 * @memberOf ui
 */
export default class Template {
	/**
	 * Creates an instance of the {@link ui.Template} class.
	 *
	 * @param {ui.TemplateDefinition} def The definition of the template.
	 */
	constructor( def ) {
		Object.assign( this, normalize( clone( def ) ) );

		/**
		 * Tag of this template, i.e. `div`, indicating that the instance will render
		 * to an HTMLElement.
		 *
		 * @member {String} ui.Template#tag
		 */

		/**
		 * Text of this template, indicating that the instance will render to a DOM Text.
		 *
		 * @member {Array.<String|ui.TemplateValueSchema> ui.Template#text
		 */

		/**
		 * Attributes of this template, i.e. `{ id: [ 'ck-id' ] }`, corresponding with
		 * HTML attributes on HTMLElement.
		 *
		 * Note: Only when {@link ui.Template#tag} is defined.
		 *
		 * @member {Object} ui.Template#attributes
		 */

		/**
		 * Children of this template; sub–templates. Each one is an independent
		 * instance of {@link ui.Template}.
		 *
		 * Note: Only when {@link ui.Template#tag} is defined.
		 *
		 * @member {utils.Collection.<ui.Template>} ui.Template#children
		 */

		/**
		 * DOM event listeners of this template.
		 *
		 * @member {Object} ui.Template#eventListeners
		 */
	}

	/**
	 * Renders a DOM Node (`HTMLElement` or `Text`) out of the template.
	 *
	 * @see {@link ui.Template#apply}.
	 *
	 * @returns {HTMLElement|Text}
	 */
	render() {
		return this._renderNode( undefined, true );
	}

	/**
	 * Applies the template to an existing DOM Node, either `HTMLElement` or `Text`.
	 *
	 * **Note:** No new DOM nodes (HTMLElement or Text) will be created. Applying extends
	 * attributes ({@link ui.TemplateDefinition#attributes}) and listeners ({@link ui.TemplateDefinition#on}) only.
	 *
	 *		const element = document.createElement( 'div' );
	 *		const bind = Template.bind( observableInstance, emitterInstance );
	 *
	 *		new Template( {
	 *			attrs: {
	 *				id: 'first-div',
	 *				class: bind.to( 'divClass' )
	 *			},
	 *			on: {
	 *				click: bind( 'elementClicked' ) // Will be fired by the observableInstance.
	 *			}
	 *			children: [
	 *				'Div text.'
	 *			]
	 *		} ).apply( element );
	 *
	 *		element.outerHTML == "<div id="first-div" class="my-div">Div text.</div>"
	 *
	 * @see ui.Template#render
	 * @param {Node} element Root element for the template to apply.
	 */
	apply( node ) {
		if ( !node ) {
			/**
			 * No DOM Node specified.
			 *
			 * @error ui-template-wrong-syntax
			 */
			throw new CKEditorError( 'ui-template-wrong-node: No DOM Node specified.' );
		}

		return this._renderNode( node );
	}

	/**
	 * An entry point to the interface which allows binding DOM nodes to {@link utils.Observable}.
	 * There are two types of bindings:
	 *
	 * * `HTMLElement` attributes or Text Node `textContent` can be synchronized with {@link utils.Observable}
	 * instance attributes. See {@link ui.Template.bind#to} and {@link ui.Template.bind#if}.
	 *
	 * * DOM events fired on `HTMLElement` can be propagated through {@link utils.Observable}.
	 * See {@link ui.Template.bind#to}.
	 *
	 * @param {utils.Observable} observable An instance of ObservableMixin class.
	 * @param {utils.Emitter} emitter An instance of `Emitter` class. It listens
	 * to `observable` attribute changes and DOM Events, depending on the binding. Usually {@link ui.View} instance.
	 * @returns {Object}
	 */
	static bind( observable, emitter ) {
		return {
			/**
			 * Binds {@link utils.Observable} instance to:
			 *  * HTMLElement attribute or Text Node `textContent` so remains in sync with the Observable when it changes:
			 *  * HTMLElement DOM event, so the DOM events are propagated through Observable.
			 *
			 *		const bind = Template.bind( observableInstance, emitterInstance );
			 *
			 *		new Template( {
			 *			tag: 'p',
			 *			attributes: {
			 *				// class="..." attribute gets bound to `observableInstance#a`
			 *				'class': bind.to( 'a' )
			 *			},
			 *			children: [
			 *				// <p>...</p> gets bound to `observableInstance#b`; always `toUpperCase()`.
			 *				{ text: bind.to( 'b', ( value, node ) => value.toUpperCase() ) }
			 *			],
			 *			on: {
			 *				click: [
			 *					// "clicked" event will be fired on `observableInstance` when "click" fires in DOM.
			 *					bind.to( 'clicked' ),
			 *
			 *					// A custom callback function will be executed when "click" fires in DOM.
			 *					bind.to( () => {
			 *						...
			 *					} )
			 *				]
			 *			}
			 *		} ).render();
			 *
			 *		const bind = Template.bind( observableInstance, emitterInstance );
			 *
			 *		new Template( {
			 *			tag: 'p',
			 *		} ).render();
			 *
			 * @static
			 * @method ui.Template.bind#to
			 * @param {String|Function} eventNameOrFunctionOrAttribute An attribute name of {@link utils.Observable} or a DOM
			 * event name or an event callback.
			 * @param {Function} [callback] Allows processing of the value. Accepts `Node` and `value` as arguments.
			 * @return {ui.TemplateBinding}
			 */
			to( eventNameOrFunctionOrAttribute, callback ) {
				return new TemplateToBinding( {
					eventNameOrFunction: eventNameOrFunctionOrAttribute,
					attribute: eventNameOrFunctionOrAttribute,
					observable, emitter, callback
				} );
			},

			/**
			 * Binds {@link utils.Observable} to HTMLElement attribute or Text Node `textContent`
			 * so remains in sync with the Model when it changes. Unlike {@link ui.Template.bind#to},
			 * it controls the presence of the attribute/`textContent` depending on the "falseness" of
			 * {@link utils.Observable} attribute.
			 *
			 *		const bind = Template.bind( observableInstance, emitterInstance );
			 *
			 *		new Template( {
			 *			tag: 'input',
			 *			attributes: {
			 *				// <input checked> when `observableInstance#a` is not undefined/null/false/''
			 *				// <input> when `observableInstance#a` is undefined/null/false
			 *				checked: bind.if( 'a' )
			 *			},
			 *			children: [
			 *				{
			 *					// <input>"b-is-not-set"</input> when `observableInstance#b` is undefined/null/false/''
			 *					// <input></input> when `observableInstance#b` is not "falsy"
			 *					text: bind.if( 'b', 'b-is-not-set', ( value, node ) => !value )
			 *				}
			 *			]
			 *		} ).render();
			 *
			 * @static
			 * @method ui.Template.bind#if
			 * @param {String} attribute An attribute name of {@link utils.Observable} used in the binding.
			 * @param {String} [valueIfTrue] Value set when {@link utils.Observable} attribute is not undefined/null/false/''.
			 * @param {Function} [callback] Allows processing of the value. Accepts `Node` and `value` as arguments.
			 * @return {ui.TemplateBinding}
			 */
			if( attribute, valueIfTrue, callback ) {
				return new TemplateIfBinding( {
					observable, emitter, attribute, valueIfTrue, callback
				} );
			}
		};
	}

	/**
	 * Extends {@link ui.Template} instance with additional content from {@link ui.TemplateDefinition}.
	 *
	 *		const bind = Template.bind( observable, emitterInstance );
	 *		const instance = new Template( {
	 *			tag: 'p',
	 *			attributes: {
	 *				class: 'a',
	 *				data-x: bind.to( 'foo' )
	 *			},
	 *			children: [
	 *				{
	 *					tag: 'span',
	 *					attributes: {
	 *						class: 'b'
	 *					},
	 *					children: [
	 *						'Span'
	 *					]
	 *				}
	 *			]
	 *		 } );
	 *
	 *		// Instance-level extension.
	 *		Template.extend( instance, {
	 *			attributes: {
	 *				class: 'b',
	 *				data-x: bind.to( 'bar' )
	 *			},
	 *			children: [
	 *				{
	 *					attributes: {
	 *						class: 'c'
	 *					}
	 *				}
	 *			]
	 *		} );
	 *
	 *		// Child extension.
	 *		Template.extend( instance.children.get( 0 ), {
	 *			attributes: {
	 *				class: 'd'
	 *			}
	 *		} );
	 *
	 * the `instance.render().outerHTML` is
	 *
	 *		<p class="a b" data-x="{ observable.foo } { observable.bar }">
	 *			<span class="b c d">Span</span>
	 *		</p>
	 *
	 * @param {ui.Template} template Existing Template instance to be extended.
	 * @param {ui.TemplateDefinition} def An extension to existing an template instance.
	 */
	static extend( template, def ) {
		extendTemplate( template, normalize( clone( def ) ) );
	}

	/**
	 * Renders a DOM Node (either `HTMLElement` or `Text`) out of the template.
	 *
	 * @protected
	 * @param {Node} applyNode If specified, this template will be applied to an existing DOM Node.
	 * @param {Boolean} intoFragment If set, children are rendered into `DocumentFragment`.
	 * @returns {HTMLElement|Text} A rendered Node.
	 */
	_renderNode( applyNode, intoFragment ) {
		let isInvalid;

		if ( applyNode ) {
			// When applying, a definition cannot have "tag" and "text" at the same time.
			isInvalid = this.tag && this.text;
		} else {
			// When rendering, a definition must have either "tag" or "text": XOR( this.tag, this.text ).
			isInvalid = this.tag ? this.text : !this.text;
		}

		if ( isInvalid ) {
			/**
			 * Node definition cannot have "tag" and "text" properties at the same time.
			 * Node definition must have either "tag" or "text" when rendering new Node.
			 *
			 * @error ui-template-wrong-syntax
			 */
			throw new CKEditorError( 'ui-template-wrong-syntax: Node definition must have either "tag" or "text" when rendering new Node.' );
		}

		return this.text ? this._renderText( applyNode ) : this._renderElement( applyNode, intoFragment );
	}

	/**
	 * Renders an `HTMLElement` out of the template.
	 *
	 * @protected
	 * @param {HTMLElement} applyElement If specified, this template will be applied to an existing `HTMLElement`.
	 * @param {Boolean} intoFragment If set, children are rendered into `DocumentFragment`.
	 * @returns {HTMLElement} A rendered `HTMLElement`.
	 */
	_renderElement( applyElement, intoFragment ) {
		const el = applyElement ||
			document.createElementNS( this.ns || xhtmlNs, this.tag );

		this._renderAttributes( el );

		// Invoke children recursively.
		if ( intoFragment ) {
			const docFragment = document.createDocumentFragment();

			this._renderElementChildren( el, docFragment );

			el.appendChild( docFragment );
		} else {
			this._renderElementChildren( el, el, !!applyElement );
		}

		// Setup DOM bindings event listeners.
		this._setUpListeners( el );

		return el;
	}

	/**
	 * Renders a `Text` node out of {@link ui.Template#text}.
	 *
	 * @protected
	 * @param {HTMLElement} textNode If specified, this template instance will be applied to an existing `Text` Node.
	 * @returns {Text} A rendered `Text` node in DOM.
	 */
	_renderText( textNode = document.createTextNode( '' ) ) {
		// Check if this Text Node is bound to Observable. Cases:
		//		{ text: [ Template.bind( ... ).to( ... ) ] }
		//		{ text: [ 'foo', Template.bind( ... ).to( ... ), ... ] }
		if ( hasTemplateBinding( this.text ) ) {
			this._bindToObservable( this.text, textNode, getTextUpdater( textNode ) );
		}

		// Simply set text. Cases:
		// 		{ text: [ 'all', 'are', 'static' ] }
		// 		{ text: [ 'foo' ] }
		else {
			textNode.textContent = this.text.join( '' );
		}

		return textNode;
	}

	/**
	 * Renders an `HTMLElement` attributes out of {@link ui.Template#attributes}.
	 *
	 * @protected
	 * @param {HTMLElement} el `HTMLElement` which attributes are to be rendered.
	 */
	_renderAttributes( el ) {
		let attrName, attrValue, attrNs;

		if ( !this.attributes ) {
			return;
		}

		for ( attrName in this.attributes ) {
			attrValue = this.attributes[ attrName ];

			// Detect custom namespace:
			// 		{ class: { ns: 'abc', value: Template.bind( ... ).to( ... ) } }
			attrNs = isObject( attrValue[ 0 ] ) && attrValue[ 0 ].ns ? attrValue[ 0 ].ns : null;

			// Activate binding if one is found. Cases:
			// 		{ class: [ Template.bind( ... ).to( ... ) ] }
			// 		{ class: [ 'bar', Template.bind( ... ).to( ... ), 'baz' ] }
			// 		{ class: { ns: 'abc', value: Template.bind( ... ).to( ... ) } }
			if ( hasTemplateBinding( attrValue ) ) {
				this._bindToObservable(
					// Normalize attributes with additional data like namespace:
					//		{ class: { ns: 'abc', value: [ ... ] } }
					attrNs ? attrValue[ 0 ].value : attrValue,
					el,
					getAttributeUpdater( el, attrName, attrNs )
				);
			}

			// Style attribute could be an Object so it needs to be parsed in a specific way.
			//		style: {
			//			width: '100px',
			//			height: Template.bind( ... ).to( ... )
			//		}
			else if ( attrName == 'style' && typeof attrValue[ 0 ] !== 'string' ) {
				this._renderStyleAttribute( attrValue[ 0 ], el );
			}

			// Otherwise simply set the static attribute.
			// 		{ class: [ 'foo' ] }
			// 		{ class: [ 'all', 'are', 'static' ] }
			// 		{ class: [ { ns: 'abc', value: [ 'foo' ] } ] }
			else {
				attrValue = attrValue
					// Retrieve "values" from { class: [ { ns: 'abc', value: [ ... ] } ] }
					.map( v => v ? ( v.value || v ) : v )
					// Flatten the array.
					.reduce( ( p, n ) => p.concat( n ), [] )
					// Convert into string.
					.reduce( arrayValueReducer, '' );

				if ( !isFalsy( attrValue ) ) {
					el.setAttributeNS( attrNs, attrName, attrValue );
				}
			}
		}
	}

	/**
	 * Renders `style` attribute of an `HTMLElement` based on {@link ui.Template#attributes}.
	 *
	 * Style attribute is an {Object} with static values:
	 *
	 *		attributes: {
	 * 			style: {
	 * 				color: 'red'
	 * 			}
	 * 		}
	 *
	 * or values bound to {@link ui.Model} properties:
	 *
	 *		attributes: {
	 * 			style: {
	 * 				color: bind.to( ... )
	 * 			}
	 * 		}
	 *
	 * Note: `style` attribute is rendered without setting the namespace. It does not seem to be
	 * needed.
	 *
	 * @private
	 * @param {ui.TemplateDefinition.attributes.styles} styles Styles definition.
	 * @param {HTMLElement} el `HTMLElement` which `style` attribute is rendered.
	 */
	_renderStyleAttribute( styles, el ) {
		for ( let styleName in styles ) {
			const styleValue = styles[ styleName ];

			// style: {
			//	color: bind.to( 'attribute' )
			// }
			if ( hasTemplateBinding( styleValue ) ) {
				this._bindToObservable( [ styleValue ], el, getStyleUpdater( el, styleName ) );
			}

			// style: {
			//	color: 'red'
			// }
			else {
				el.style[ styleName ] = styleValue;
			}
		}
	}

	/**
	 * Recursively renders `HTMLElement` children from {@link ui.Template#children}.
	 *
	 * @protected
	 * @param {HTMLElement} element The element which is being rendered.
	 * @param {HTMLElement|DocumentFragment} container `HTMLElement` or `DocumentFragment`
	 * into which children are being rendered. If `shouldApply == true`, then `container === element`.
	 * @param {Boolean} shouldApply Traverse existing DOM structure only, don't modify DOM.
	 */
	_renderElementChildren( element, container, shouldApply ) {
		let childIndex = 0;

		for ( let child of this.children ) {
			if ( isViewCollection( child ) ) {
				if ( !shouldApply ) {
					child.setParent( element );

					for ( let view of child ) {
						container.appendChild( view.element );
					}
				}
			} else if ( isView( child ) ) {
				if ( !shouldApply ) {
					container.appendChild( child.element );
				}
			} else {
				if ( shouldApply ) {
					child._renderNode( container.childNodes[ childIndex++ ] );
				} else {
					container.appendChild( child.render() );
				}
			}
		}
	}

	/**
	 * Activates {@link ui.Template#on} listeners on a passed `HTMLElement`.
	 *
	 * @protected
	 * @param {HTMLElement} el `HTMLElement` which is being rendered.
	 */
	_setUpListeners( el ) {
		if ( !this.eventListeners ) {
			return;
		}

		for ( let key in this.eventListeners ) {
			const [ domEvtName, domSelector ] = key.split( '@' );

			this.eventListeners[ key ].forEach( schemaItem => {
				schemaItem.activateDomEventListener( el, domEvtName, domSelector );
			} );
		}
	}

	/**
	 * For given {@link ui.TemplateValueSchema} containing {@link ui.TemplateBinding} it activates the
	 * binding and sets its initial value.
	 *
	 * Note: {@link ui.TemplateValueSchema} can be for HTMLElement attributes or Text Node `textContent`.
	 *
	 * @protected
	 * @param {ui.TemplateValueSchema} valueSchema
	 * @param {Node} node DOM Node to be updated when {@link utils.Observable} changes.
	 * @param {Function} domUpdater A function which updates DOM (like attribute or text).
	 */
	_bindToObservable( valueSchema ) {
		valueSchema
			// Filter "falsy" (false, undefined, null, '') value schema components out.
			.filter( item => !isFalsy( item ) )
			// Filter inactive bindings from schema, like static strings ('foo'), numbers (42), etc.
			.filter( item => item.observable )
			// Once only the actual binding are left, let the emitter listen to observable change:attribute event.
			// TODO: Reduce the number of listeners attached as many bindings may listen
			// to the same observable attribute.
			.forEach( templateBinding => templateBinding.activateAttributeListener( ...arguments ) );

		// Set initial values.
		syncValueSchemaValue( ...arguments );
	}
}

mix( Template, EmitterMixin );

/**
 * Describes a binding created by {@link ui.Template#bind} interface.
 *
 * @protected
 * @memberOf ui
 */
export class TemplateBinding {
	/**
	 * Creates an instance of the {@link ui.TemplateBinding} class.
	 *
	 * @param {ui.TemplateBindingDefinition} def The definition of the binding.
	 */
	constructor( def ) {
		Object.assign( this, def );

		/**
		 * An observable instance of the binding. It provides the attribute
		 * with the value or passes the event when a corresponding DOM event is fired.
		 *
		 * @member {utils.Observable} ui.TemplateBinding#observable
		 */

		/**
		 * An {@link utils.Emitter} instance used by the binding
		 * to (either):
		 *
		 * * listen to the attribute change in the {@link ui.TemplateBinding#observable},
		 * * listen to the event in the DOM.
		 *
		 * @member {utils.Emitter} ui.TemplateBinding#emitter
		 */

		/**
		 * The name of the attribute of {@link ui.TemplateBinding#observable} which is observed.
		 *
		 * @member {String} ui.TemplateBinding#attribute
		 */

		/**
		 * A custom function to process the value of {@link ui.TemplateBinding#attribute}.
		 *
		 * @member {Function} [ui.TemplateBinding#callback]
		 */
	}

	/**
	 * Returns the value of the binding, which is the value of {@link ui.TemplateBinding#attribute} in
	 * {@link ui.TemplateBinding#observable}.
	 *
	 * @param {Node} [node] A native DOM node, passed to the custom {@link ui.TemplateBinding#callback}.
	 * @returns {*} The value of {@link ui.TemplateBinding#attribute} in {@link ui.TemplateBinding#observable}.
	 */
	getValue( domNode ) {
		const value = this.observable[ this.attribute ];

		return this.callback ? this.callback( value, domNode ) : value;
	}

	/**
	 * Activates the listener for the changes of {@link ui.TemplateBinding#attribute} in
	 * {@link ui.TemplateBinding#observable}, which then updates the DOM with the aggregated
	 * value of {@link ui.TemplateValueSchema}.
	 *
	 * For instance, the `class` attribute of the `Template` element can be be bound to
	 * the observable `foo` attribute in `ObservableMixin` instance.
	 *
	 * @param {ui.TemplateValueSchema} valueSchema A full schema to generate an attribute or text in DOM.
	 * @param {Node} node A native DOM node, which attribute or text is to be updated.
	 * @param {Function} updater A DOM updater function used to update native DOM attribute or text.
	 */
	activateAttributeListener( valueSchema, node, updater ) {
		this.emitter.listenTo( this.observable, 'change:' + this.attribute, () => {
			syncValueSchemaValue( valueSchema, node, updater );
		} );
	}
}

/**
 * Describes either
 *
 * * a binding to {@link utils.Observable}
 * * or a native DOM event binding
 *
 * created by {@link ui.Template.bind#to} method.
 *
 * @protected
 * @memberOf ui
 */
export class TemplateToBinding extends TemplateBinding {
	/**
	 * Activates the listener for the native DOM event, which when fired, is propagated by
	 * the {@link ui.TemplateBinding#emitter}.
	 *
	 * @param {HTMLElement} element An element on which listening to the native DOM event.
	 * @param {String} domEvtName A name of the native DOM event.
	 * @param {String} [domSelector] A selector in DOM to filter delegated events.
	 */
	activateDomEventListener( el, domEvtName, domSelector ) {
		this.emitter.listenTo( el, domEvtName, ( evt, domEvt ) => {
			if ( !domSelector || domEvt.target.matches( domSelector ) ) {
				if ( typeof this.eventNameOrFunction == 'function' ) {
					this.eventNameOrFunction( domEvt );
				} else {
					this.observable.fire( this.eventNameOrFunction, domEvt );
				}
			}
		} );
	}
}

/**
 * Describes a binding to {@link utils.Observable} created by {@link ui.Template.bind#if} method.
 *
 * @protected
 * @memberOf ui
 */
export class TemplateIfBinding extends TemplateBinding {
	/**
	 * @inheritDoc
	 */
	getValue( domNode ) {
		const value = super.getValue( domNode );

		return isFalsy( value ) ? false : ( this.valueIfTrue || true );
	}

	/**
	 * The value of the DOM attribute/text to be set if the {@link ui.TemplateBinding#attribute} in
	 * {@link ui.TemplateBinding#observable} is `true`.
	 *
	 * @member {String} [ui.TemplateIfBinding#valueIfTrue]
	 */
}

// Checks whether given {@link ui.TemplateValueSchema} contains a
// {@link ui.TemplateBinding}.
//
// @param {ui.TemplateValueSchema} valueSchema
// @returns {Boolean}
function hasTemplateBinding( valueSchema ) {
	if ( !valueSchema ) {
		return false;
	}

	// Normalize attributes with additional data like namespace:
	// 		class: { ns: 'abc', value: [ ... ] }
	if ( valueSchema.value ) {
		valueSchema = valueSchema.value;
	}

	if ( Array.isArray( valueSchema ) ) {
		return valueSchema.some( hasTemplateBinding );
	} else if ( valueSchema instanceof TemplateBinding ) {
		return true;
	}

	return false;
}

// Assembles the value using {@link ui.TemplateValueSchema} and stores it in a form of
// an Array. Each entry of an Array corresponds to one of {@link ui.TemplateValueSchema}
// items.
//
// @param {ui.TemplateValueSchema} valueSchema
// @param {Node} node DOM Node updated when {@link utils.Observable} changes.
// @return {Array}
function getValueSchemaValue( valueSchema, domNode ) {
	return valueSchema.map( schemaItem => {
		// Process {@link ui.TemplateBinding} bindings.
		if ( schemaItem instanceof TemplateBinding ) {
			return schemaItem.getValue( domNode );
		}

		// All static values like strings, numbers, and "falsy" values (false, null, undefined, '', etc.) just pass.
		return schemaItem;
	} );
}

// A function executed each time bound Observable attribute changes, which updates DOM with a value
// constructed from {@link ui.TemplateValueSchema}.
//
// @param {ui.TemplateValueSchema} valueSchema
// @param {Node} node DOM Node updated when {@link utils.Observable} changes.
// @param {Function} domUpdater A function which updates DOM (like attribute or text).
function syncValueSchemaValue( valueSchema, domNode, domUpdater ) {
	let value = getValueSchemaValue( valueSchema, domNode );

	// Check if valueSchema is a single Template.bind.if, like:
	//		{ class: Template.bind.if( 'foo' ) }
	if ( valueSchema.length == 1 && valueSchema[ 0 ] instanceof TemplateIfBinding ) {
		value = value[ 0 ];
	} else {
		value = value.reduce( arrayValueReducer, '' );
	}

	if ( isFalsy( value ) ) {
		domUpdater.remove();
	} else {
		domUpdater.set( value );
	}
}

// Returns an object consisting of `set` and `remove` functions, which
// can be used in the context of DOM Node to set or reset `textContent`.
// @see ui.View#_bindToObservable
//
// @param {Node} node DOM Node to be modified.
// @returns {Object}
function getTextUpdater( node ) {
	return {
		set( value ) {
			node.textContent = value;
		},

		remove() {
			node.textContent = '';
		}
	};
}

// Returns an object consisting of `set` and `remove` functions, which
// can be used in the context of DOM Node to set or reset an attribute.
// @see ui.View#_bindToObservable
//
// @param {Node} node DOM Node to be modified.
// @param {String} attrName Name of the attribute to be modified.
// @param {String} [ns=null] Namespace to use.
// @returns {Object}
function getAttributeUpdater( el, attrName, ns = null ) {
	return {
		set( value ) {
			el.setAttributeNS( ns, attrName, value );
		},

		remove() {
			el.removeAttributeNS( ns, attrName );
		}
	};
}

// Returns an object consisting of `set` and `remove` functions, which
// can be used in the context of CSSStyleDeclaration to set or remove a style.
// @see ui.View#_bindToObservable
//
// @param {Node} node DOM Node to be modified.
// @param {String} styleName Name of the style to be modified.
// @returns {Object}
function getStyleUpdater( el, styleName ) {
	return {
		set( value ) {
			el.style[ styleName ] = value;
		},

		remove() {
			el.style[ styleName ] = null;
		}
	};
}

// Clones definition of the template.
//
// @param {ui.TemplateDefinition} def
// @returns {ui.TemplateDefinition}
function clone( def ) {
	const clone = cloneDeepWith( def, value => {
		// Don't clone the `Template.bind`* bindings because of the references to Observable
		// and DOMEmitterMixin instances inside, which would also be traversed and cloned by greedy
		// cloneDeepWith algorithm. There's no point in cloning Observable/DOMEmitterMixins
		// along with the definition.
		//
		// Also don't clone View instances if provided as a child of the Template. The template
		// instance will be extracted from the View during the normalization and there's no need
		// to clone it.
		if ( value && ( value instanceof TemplateBinding || isView( value ) || isViewCollection( value ) ) ) {
			return value;
		}
	} );

	return clone;
}

// Normalizes given {@link ui.TemplateDefinition}.
//
// See:
//  * {@link normalizeAttributes}
//  * {@link normalizeListeners}
//  * {@link normalizePlainTextDefinition}
//  * {@link normalizeTextDefinition}
//
// @param {ui.TemplateDefinition} def
// @returns {ui.TemplateDefinition} Normalized definition.
function normalize( def ) {
	if ( typeof def == 'string' ) {
		def = normalizePlainTextDefinition( def );
	} else if ( def.text ) {
		normalizeTextDefinition( def );
	}

	if ( def.on ) {
		def.eventListeners = normalizeListeners( def.on );

		// Template mixes EmitterMixin, so delete #on to avoid collision.
		delete def.on;
	}

	if ( !def.text ) {
		if ( def.attributes ) {
			normalizeAttributes( def.attributes );
		}

		const children = new Collection();

		if ( def.children ) {
			if ( isViewCollection( def.children ) ) {
				children.add( def.children );
			} else {
				for ( let child of def.children ) {
					if ( isView( child ) ) {
						children.add( child );
					} else {
						children.add( new Template( child ) );
					}
				}
			}
		}

		def.children = children;
	}

	return def;
}

// Normalizes "attributes" section of {@link ui.TemplateDefinition}.
//
//		attributes: {
//			a: 'bar',
//			b: {@link ui.TemplateBinding},
//			c: {
//				value: 'bar'
//			}
//		}
//
// becomes
//
//		attributes: {
//			a: [ 'bar' ],
//			b: [ {@link ui.TemplateBinding} ],
//			c: {
//				value: [ 'bar' ]
//			}
//		}
//
// @param {Object} attrs
function normalizeAttributes( attrs ) {
	for ( let a in attrs ) {
		if ( attrs[ a ].value ) {
			attrs[ a ].value = [].concat( attrs[ a ].value );
		}

		arrayify( attrs, a );
	}
}

// Normalizes "on" section of {@link ui.TemplateDefinition}.
//
//		on: {
//			a: 'bar',
//			b: {@link ui.TemplateBinding},
//			c: [ {@link ui.TemplateBinding}, () => { ... } ]
//		}
//
// becomes
//
//		on: {
//			a: [ 'bar' ],
//			b: [ {@link ui.TemplateBinding} ],
//			c: [ {@link ui.TemplateBinding}, () => { ... } ]
//		}
//
// @param {Object} listeners
// @returns {Object} Object containing normalized listeners.
function normalizeListeners( listeners ) {
	for ( let l in listeners ) {
		arrayify( listeners, l );
	}

	return listeners;
}

// Normalizes "string" {@link ui.TemplateDefinition}.
//
//		"foo"
//
// becomes
//
//		{ text: [ 'foo' ] },
//
// @param {String} def
// @returns {ui.TemplateDefinition} Normalized template definition.
function normalizePlainTextDefinition( def ) {
	return {
		text: [ def ]
	};
}

// Normalizes text {@link ui.TemplateDefinition}.
//
//		children: [
//			{ text: 'def' },
//			{ text: {@link ui.TemplateBinding} }
//		]
//
// becomes
//
//		children: [
//			{ text: [ 'def' ] },
//			{ text: [ {@link ui.TemplateBinding} ] }
//		]
//
// @param {ui.TemplateDefinition} def
function normalizeTextDefinition( def ) {
	if ( !Array.isArray( def.text ) ) {
		def.text = [ def.text ];
	}
}

// Wraps an entry in Object in an Array, if not already one.
//
//		{
//			x: 'y',
//			a: [ 'b' ]
//		}
//
// becomes
//
//		{
//			x: [ 'y' ],
//			a: [ 'b' ]
//		}
//
// @param {Object} obj
// @param {String} key
function arrayify( obj, key ) {
	if ( !Array.isArray( obj[ key ] ) ) {
		obj[ key ] = [ obj[ key ] ];
	}
}

// A helper which concatenates the value avoiding unwanted
// leading white spaces.
//
// @param {String} prev
// @param {String} cur
// @returns {String}
function arrayValueReducer( prev, cur ) {
	if ( isFalsy( cur ) ) {
		return prev;
	} else if ( isFalsy( prev ) )  {
		return cur;
	} else {
		return `${prev} ${cur}`;
	}
}

// Extends one object defined in the following format:
//
//		{
//			key1: [Array1],
//			key2: [Array2],
//			...
//			keyN: [ArrayN]
//		}
//
// with another object of the same data format.
//
// @param {Object} obj Base object.
// @param {Object} ext Object extending base.
// @returns {String}
function extendObjectValueArray( obj, ext ) {
	for ( let a in ext ) {
		if ( obj[ a ] ) {
			obj[ a ].push( ...ext[ a ] );
		} else {
			obj[ a ] = ext[ a ];
		}
	}
}

// A helper for {@link ui.Template#extend}. Recursively extends {@link ui.Template} instance
// with content from {ui.TemplateDefinition}. See {@link ui.Template#extend} to learn more.
//
// @param {ui.Template} def A template instance to be extended.
// @param {ui.TemplateDefinition} def A definition which is to extend the template instance.
function extendTemplate( template, def ) {
	if ( def.attributes ) {
		if ( !template.attributes ) {
			template.attributes = {};
		}

		extendObjectValueArray( template.attributes, def.attributes );
	}

	if ( def.eventListeners ) {
		if ( !template.eventListeners ) {
			template.eventListeners = {};
		}

		extendObjectValueArray( template.eventListeners, def.eventListeners );
	}

	if ( def.text ) {
		template.text.push( ...def.text );
	}

	if ( def.children && def.children.length ) {
		if ( template.children.length != def.children.length ) {
			/**
			 * The number of children in extended definition does not match.
			 *
			 * @error ui-template-extend-children-mismatch
			 */
			throw new CKEditorError( 'ui-template-extend-children-mismatch: The number of children in extended definition does not match.' );
		}

		let childIndex = 0;

		for ( let childDef of def.children ) {
			extendTemplate( template.children.get( childIndex++ ), childDef );
		}
	}
}

// Checks if value is "falsy".
// Note: 0 (Number) is not "falsy" in this context.
//
// @private
// @param {*} value Value to be checked.
function isFalsy( value ) {
	return !value && value !== 0;
}

// Checks if the item is an instance of {@link ui.View}
//
// @private
// @param {*} value Value to be checked.
function isView( item ) {
	return item instanceof View;
}

// Checks if the item is an instance of {@link ui.ViewCollection}
//
// @private
// @param {*} value Value to be checked.
function isViewCollection( item ) {
	return item instanceof ViewCollection;
}

/**
 * A definition of {@link ui.Template}.
 * See: {@link ui.TemplateValueSchema}.
 *
 *		new Template( {
 *			tag: 'p',
 *			children: [
 *				{
 *					tag: 'span',
 *					attributes: { ... },
 *					children: [ ... ],
 *					...
 *				},
 *				{
 *					text: 'static–text'
 *				},
 *				'also-static–text',
 *				<{@link ui.View} instance>
 *				...
 *			],
 *			attributes: {
 *				class: {@link ui.TemplateValueSchema},
 *				id: {@link ui.TemplateValueSchema},
 *				style: {@link ui.TemplateValueSchema}
 *				...
 *			},
 *			on: {
 *				'click': {@link ui.TemplateListenerSchema}
 *				'keyup@.some-class': {@link ui.TemplateListenerSchema},
 *				...
 *			}
 *		} );
 *
 *		// An entire view collection can be used as a child in the definition.
 *		new Template( {
 *			tag: 'p',
 *			children: <{@link ui.ViewCollection} instance>
 *		} );
 *
 * @typedef ui.TemplateDefinition
 * @type Object
 * @property {String} tag
 * @property {Array.<ui.TemplateDefinition>} [children]
 * @property {Object.<String,ui.TemplateValueSchema>} [attributes]
 * @property {String|ui.TemplateValueSchema|Array.<String|ui.TemplateValueSchema>} [text]
 * @property {Object.<String,ui.TemplateListenerSchema>} [on]
 */

/**
 * Describes a value of HTMLElement attribute or `textContent`. See:
 *  * {@link ui.TemplateDefinition},
 *  * {@link ui.Template#bind},
 *
 *		const bind = Template.bind( observableInstance, emitterInstance );
 *
 *		new Template( {
 *			tag: 'p',
 *			attributes: {
 *				// Plain String schema.
 *				class: 'static-text'
 *
 *				// Object schema, an `ObservableMixin` binding.
 *				class: bind.to( 'foo' )
 *
 *				// Array schema, combines the above.
 *				class: [
 *					'static-text',
 *					bind.to( 'bar', () => { ... } )
 *				],
 *
 *				// Array schema, with custom namespace.
 *				class: {
 *					ns: 'http://ns.url',
 *					value: [
 *						bind.if( 'baz', 'value-when-true' )
 *						'static-text'
 *					]
 *				},
 *
 *				// Object literal schema, specific for styles.
 *				style: {
 *					color: 'red',
 *					backgroundColor: bind.to( 'qux', () => { ... } )
 *				}
 *			}
 *		} );
 *
 * @typedef ui.TemplateValueSchema
 * @type {Object|String|Array}
 */

/**
 * Describes a listener attached to HTMLElement. See: {@link ui.TemplateDefinition}.
 *
 *		new Template( {
 *			tag: 'p',
 *			on: {
 *				// Plain String schema.
 *				click: 'clicked'
 *
 *				// Object schema, an `ObservableMixin` binding.
 *				click: {@link ui.TemplateBinding}
 *
 *				// Array schema, combines the above.
 *				click: [
 *					'clicked',
 *					{@link ui.TemplateBinding}
 *				],
 *
 *				// Array schema, with custom callback.
 *				// Note: It will work for "click" event on class=".foo" children only.
 *				'click@.foo': {
 *					'clicked',
 *					{@link ui.TemplateBinding},
 *					() => { ... }
 *				}
 *			}
 *		} );
 *
 * @typedef ui.TemplateListenerSchema
 * @type {Object|String|Array}
 */
