import React from 'react';
import Lifespan from 'lifespan';
import moment from 'moment';
import {Link} from 'react-router';
import uniqWith from 'lodash/uniqWith';

import LocalClient from '../../stores/local-client.stores.jsx';

import getCurrency from '../../helpers/currency.helpers.js';

import DisplayWithLabel from '../shared/display-with-label.components.jsx';
import FormSuccess from '../shared/form-success.components.jsx';
import Price from '../shared/price.components';

export default class AccountSubscription extends React.PureComponent {
	constructor(props) {
		super(props);
		this.state = {
			cards: [],
		};
	}

	componentWillMount() {
		this.client = LocalClient.instance();
		this.lifespan = new Lifespan();

		this.client.getStore('/userStore', this.lifespan)
			.onUpdate((head) => {
				const {subscription, cards} = head.toJS().d;

				this.setState({
					subscription,
					cards,
				});
			})
			.onDelete(() => {
				this.setState(undefined);
			});

		this.client.getStore('/prototypoStore', this.lifespan)
			.onUpdate((head) => {
				this.setState({
					credits: head.toJS().d.credits,
				});
			})
			.onDelete(() => {
				this.setState(undefined);
			});
	}

	componentWillUnmount() {
		this.lifespan.release();
	}

	render() {
		const {cards, subscription, credits} = this.state;

		const noCard = (
			<div>
				<h3 className="account-dashboard-container-small-title">
					You do not have a card right now.
				</h3>
				{subscription && !subscription.cancel_at_period_end ? (
					<p><Link className="account-link" to="/account/details/add-card">Add a card</Link> to set up your renewal automatically.</p>
				) : (
					<p><Link className="account-link" to="/account/details/add-card">Add a card</Link> before subscribing.</p>
				)}
			</div>
		);
		let currency;

		if (subscription) {
			currency = subscription.plan.currency.toUpperCase();
		}
		else if (cards.length > 0) {
			currency = getCurrency(cards[0].country);
		}

		const cardDetail = cards.length > 0 ? (
			<DisplayWithLabel label="Your cards">
				{uniqWith(cards, (first, sec) => { return first.fingerprint === sec.fingerprint; }).map((card) => { // dedupe cards
					return (
						<div className="account-subscription-card" key={card.id}>
							<div className="account-subscription-card-number">**** **** **** {card.last4}</div>
							<div className="account-subscription-name">{card.name}</div>
							<div className="account-subscription-card-expiry">Expires on {String(card.exp_month).padStart(2, 0)}/{card.exp_year}</div>
						</div>
					);
				})}
			</DisplayWithLabel>
		) : noCard;

		const creditsDetails = (
			<div>
				<div className="display-credits">
					<DisplayWithLabel label="Your export credits">
						{credits}
					</DisplayWithLabel>
				</div>
			</div>
		);

		const successCard = this.props.location.query.newCard
			? <FormSuccess successText="You've successfully added a card"/>
			: false;

		const noPlan = (
			<div>
				<h3 className="account-dashboard-container-small-title">
					You do not have a plan for the moment.
				</h3>
				<p>
					<img style={{width: '100%'}} src="assets/images/go-pro.gif" />
				</p>
				<p>
					Subscribe to our <Link className="account-link" to="account/create/choose-a-plan">pro plan</Link> to benefit of the full power of Prototypo without restrictions
					{ !credits && <span> or buy <Link className="account-link" to="dashboard?buy_credits=true">some credits</Link> to export and use your fonts everywhere</span>}!
				</p>
			</div>
		);

		const {plan} = subscription || {};
		const content = plan ? (
			<div>
				<div className="account-subscription-plan">
					<DisplayWithLabel label="Your plan">
						{plan.name}
						{subscription.status === 'trialing' && (
							<span className="badge">trial until {moment.unix(subscription.trial_end).format('L')}</span>
						)}
						{subscription.status !== 'trialing' && subscription.cancel_at_period_end && (
							<span className="badge danger">cancels on {moment.unix(subscription.current_period_end).format('L')}</span>
						)}
					</DisplayWithLabel>
				</div>
				{subscription.cancel_at_period_end && (
					<p>
						Your subscription has been canceled and will automatically end on <strong>{moment.unix(subscription.current_period_end).format('L')}</strong>.
					</p>
				)}
				{!subscription.cancel_at_period_end && cards.length < 1 && (
					<p>
						Your subscription will be canceled on <strong>{moment.unix(subscription.current_period_end).format('L')}</strong> because you don't have any card registered.
					</p>
				)}
				{!subscription.cancel_at_period_end && cards.length > 1 && (
					<p>
						Your subscription will automatically renew on <strong>{moment.unix(subscription.current_period_end).format('L')} </strong>
						and you will be charged <strong><Price amount={plan.amount / 100} currency={currency} /></strong>.
					</p>
				)}
			</div>
		) : noPlan;

		return (
			<div className="account-dashboard-container-main">
				<div className="account-base account-subscription">
					{content}
					{!!credits && creditsDetails}
					{cardDetail}
					{successCard}
				</div>
			</div>
		);
	}
}
