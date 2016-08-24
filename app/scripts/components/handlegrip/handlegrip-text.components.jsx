import React from 'react';
import ReactDOM from 'react-dom';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import LocalClient from '../../stores/local-client.stores.jsx';
import Lifespan from 'lifespan';
import DOM from '../../helpers/dom.helpers.js';

import HandlegripLetter from './handlegrip-letter.components.jsx';
import RegularLetter from './regular-letter.components.jsx';

/**
*	Component : Text in prototypo-word
*	Where you can set spacing on a specific letter
*	@extends React.Component
*/
export default class HandlegripText extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			uiWordSelection: 0,
			uiWordHandleWidth: 0,
			spacingLeft: 0,
			spacingRight: 0,
			baseSpacingLeft: 0,
			baseSpacingRight: 0,
			advanceWidth: 0,
			trackingX: 0,
			letterFontSize: 0,
			tracking: undefined,
			fontValues: undefined,
		};
		this.leftCurrentX = 0;
		this.rightCurrentX = 0;
		this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);

		// retrieve the initial values, only once
		fontInstance.getGlyphProperty(
			this.getSelectedLetter(),
			['advanceWidth', 'spacingLeft', 'spacingRight', 'baseSpacingLeft', 'baseSpacingRight'],
			({advanceWidth, spacingLeft, spacingRight, baseSpacingLeft, baseSpacingRight}) => {
				this.setState({
					advanceWidth,
					spacingLeft,
					spacingRight,
					baseSpacingLeft,
					baseSpacingRight,
				});
			}
		);

		// function bindings
		this.handleUp = this.handleUp.bind(this);
		this.handleMove = this.handleMove.bind(this);
		this.handleSelectstart = this.handleSelectstart.bind(this);
		this.dispatchAllFromFontinstance = this.dispatchAllFromFontinstance.bind(this);
	}

	async componentWillMount() {
		this.client = LocalClient.instance();
		this.lifespan = new Lifespan();

		this.client.getStore('/prototypoStore', this.lifespan)
			.onUpdate(({head}) => {
				this.setState({
					uiWordSelection: head.toJS().uiWordSelection || 0,
					uiWordHandleWidth: head.toJS().uiWordHandleWidth || 0,
					tracking: head.toJS().uiSpacingTracking,
					letterFontSize: head.toJS().uiLetterSpacingLetterFontSize || this.state.letterFontSize,
				});
			})
			.onDelete(() => {
				this.setState(undefined);
			});

		this.client.getStore('/undoableStore', this.lifespan)
			.onUpdate(({head}) => {
				this.setState({
					fontValues: head.toJS().controlsValues,
					trackingX: head.toJS().uiTrackingX,
					spacingLeft: head.toJS().spacingLeft || 0,
					spacingRight: head.toJS().spacingRight || 0,
					advanceWidth: head.toJS().advanceWidth || 0,
				});
			})
			.onDelete(() => {
				this.setState(undefined);
			});

		// make sure there is no selection while dragging
		document.addEventListener('selectstart', this.handleSelectstart);
	}

	componentDidMount() {
		const handlegripDOM = ReactDOM.findDOMNode(this);

		handlegripDOM.addEventListener('mouseup', this.handleUp);
		handlegripDOM.addEventListener('mousemove', this.handleMove);
	}

	componentWillUnmount() {
		const handlegripDOM = ReactDOM.findDOMNode(this);

		this.lifespan.release();

		document.removeEventListener('selectstart', this.handleSelectstart);
		handlegripDOM.removeEventListener('mouseup', this.handleUp);
		handlegripDOM.removeEventListener('mousemove', this.handleMove);
	}

	handleUp(e) {
		if (!this.state.tracking) {
			return;
		}

		const el = ReactDOM.findDOMNode(this);

		this.client.dispatchAction('/store-value', {
			// tells everyone to stop tracking
			uiSpacingTracking: false,
			// adjust font size
			uiWordFontSize: DOM.getProperFontSize(
				this.props.text,
				el.style,
				el.clientWidth
			),
		});

		this.dispatchAllFromFontinstance();

		e.stopPropagation();
	}

	handleMove(e) {
		if (!this.state.tracking) {
			return;
		}

		// if this expression is true, the user might have left the draggin zone while dragging
		// and might be trying to come back without the mouse being down
		// in that case we cancel operations because it might lead to an unclear state of dragging
		// event.button and event.buttons work differently but both false means no button pressed
		if (!e.button && !e.buttons) {
			return;
		}

		const leftSideTracking = this.state.tracking === 'left';
		const newX = e.pageX || e.screenX;
		const trackingX = this.state.trackingX;
		const el = ReactDOM.findDOMNode(this);
		const {offsetLeft} = DOM.getAbsOffset(el);
		// const letterAbsOffset = this.refs.selectedLetter.getAbsOffset();
		const letterOffsetWidth = this.refs.selectedLetter.getClientWidth();
		let newValue;

		// here we are going to try and avoid
		// dragging w/o being near the handle
		const barProps = leftSideTracking
			? this.refs.selectedLetter.getLeftBar()
			: this.refs.selectedLetter.getRightBar();

		// we are going from left to right
		if (newX > trackingX) {
			// so we do not want the dragging to happen
			// unless we are on the handlebar's left side or further
			if (newX < barProps.offsetLeft) {
				return;
			}
		}
		// we are going from right to left
		else if (newX > (barProps.offsetLeft + barProps.clientWidth)) {
			// so we do not want the dragging to happen
			// unless we are on the handlebar's right side or nearer
			return;
		}

		// advanceWidth is in typographic unit
		const advanceWidth = this.state.advanceWidth;
		// intiate spacing value that will be set w/ dispatchAction
		const newSpacingValues = {};

		// here we are going to find out the pixel ratio for dragging
		const dragginRatio = parseFloat(advanceWidth) / letterOffsetWidth;

		// property to edit
		const property = leftSideTracking ? 'spacingLeft' : 'spacingRight';
		// current letter's unicode
		const unicode = this.getSelectedLetter().charCodeAt(0);
		// store the special property object for the current unicode value
		const specialPropsObject = this.state.fontValues.glyphSpecialProps
			? this.state.fontValues.glyphSpecialProps[unicode]
			: {};

		// obtain variation value
		const variation = Math.round(
			(newX - trackingX) * dragginRatio
		) * (leftSideTracking ? -1 : 1);

		// compute new value
		const updatedValue = (
			(
				 specialPropsObject && specialPropsObject[property]
					? specialPropsObject[property]
					: 0
			)
			+ (variation)
		);

		// if the new X value is in the element boundaries
		if (newX >= offsetLeft && newX <= offsetLeft + el.clientWidth) {
			const baseSpacing = leftSideTracking
				? this.state.baseSpacingLeft
				: this.state.baseSpacingRight;

			newValue = updatedValue;
			newValue = Math.min(Math.max(newValue, (this.props.min - baseSpacing)), this.props.max);

		}
		else {
			newValue = newX < offsetLeft ? this.props.min : this.props.max;
		}

		// if we are currently tracking left side spacing
		if (leftSideTracking) {
			// set the new spacing value
			newSpacingValues.spacingLeft = newValue + this.state.baseSpacingLeft;
		}
		else {
			newSpacingValues.spacingRight = newValue + this.state.baseSpacingRight;
		}

		if (!Number.isNaN(newValue)) {
			this.client.dispatchAction('/change-letter-spacing', {
				value: newValue,
				side: this.state.tracking,
				letter: this.getSelectedLetter(),
			});

		}

		// if the user went to far, no need to update the tracking value and advanceWidth
		if (updatedValue <= this.props.max && updatedValue >= this.props.min) {
			newSpacingValues.uiTrackingX = newX;
			newSpacingValues.advanceWidth = variation + advanceWidth;
		}

		this.client.dispatchAction('/store-value-undoable', newSpacingValues);

	}

	/**
	*	returns the letter to select (text at the right index)
	*	@return {string} the letter
	*/
	getSelectedLetter() {
		const selectedIndex = this.state.uiWordSelection;

		if (selectedIndex >= 0 && this.props.text && selectedIndex < this.props.text.length) {
			return this.props.text[selectedIndex];
		}
		else {
			return null;
		}
	}

	dispatchAllFromFontinstance() {
		// get the new advanceWidth of the current glyph
		// directly from the globaly available font instance
		this.client.dispatchAction('/update-letter-spacing-value', {
			letter: this.getSelectedLetter(),
			valueList: ['advanceWidth', 'spacingLeft', 'spacingRight'],
		});
	}

	handleSelectstart(e) {
		// warning : this does not seem to work on "input" tags
		if (this.state.tracking) {
			return e.preventDefault();
		}
	}

	render() {
		const selectedLetter = this.state.uiWordSelection;
		const letterComponents = _.map(this.props.text.split(''), (letter, index) => {
			return (
				selectedLetter === index
				? (
					<HandlegripLetter
						letter={letter}
						ref="selectedLetter"
						spacingLeft={this.state.spacingLeft}
						spacingRight={this.state.spacingRight}
						advanceWidth={this.state.advanceWidth}
						min={this.props.min}
						max={this.props.max}
						key={index}
					/>
				)
				: (
					<RegularLetter letter={letter} key={index} index={index}/>
				)
			);
		});

		return (
			<div
				className="prototypo-word-string"
				spellCheck="false"
				style={this.props.style}
			>
				{letterComponents}
			</div>
		);
	}
}