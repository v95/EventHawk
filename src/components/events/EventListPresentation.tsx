import * as React from "react";
import { Button, Modal } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { Link } from "react-router-dom";
import { EventItem } from "./EventItem";
import { EventCard } from "./EventCard";
import { RateEvent } from "./RateEvent";
import { EventService, EventCategoryName } from "../../services/events";
import { EventListFilterSetting } from "./EventListFilterSetting";
import axios from "axios";
import { UserItem, UserService } from "../../services/user";
import { AuthenticationState } from "../../common/state/Auth";
import { VoteService } from "../../services/votes";
import * as update from 'immutability-helper';

interface State {
    expandedEventId: string,
    eventList: EventItem[],
    loading: boolean
    showRateEvent: boolean
    currentlyRatingEvent: EventItem
}

interface Props {
    authState?: AuthenticationState
    filters?: EventListFilterSetting
    history?: { push(path: string): any }
    showFilterButton?: boolean
}

export class EventListPresentation extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
            expandedEventId: null,
            eventList: [],
            loading: true,
            showRateEvent: false,
            currentlyRatingEvent: null
        }

        this.handleSubmitRating = this.handleSubmitRating.bind(this);
    }

    componentWillMount() {
        this.setState({ loading: true });
    }

    componentDidMount() {
        this.fetchEventList(this.props);
    }

    fetchEventList(props: Props) {
        EventService.getAllEventItems(props.filters).then(
            (events: EventItem[]) => {
                this.setState({ eventList: events })
                this.setState({ loading: false });
            }
        )
    }

    openRateEventModal() {
        this.setState({ showRateEvent: true });
    }

    closeRateEventModal() {
        this.setState({ showRateEvent: false });
    }

    handleRateClick(event: EventItem) {
        this.setState({ currentlyRatingEvent: event });
        this.openRateEventModal();
    }

    handleSubmitRating(hostPreparedness: number, matchedDescription: number, wouldReturn: boolean) {
        console.log("Submitted rating: " + hostPreparedness + ", " + matchedDescription + ", " + wouldReturn);
        this.closeRateEventModal();
    }

    // If an event has changed on the server as a result of user action, 
    // update the event in place in the event list if possible.
    // Otherwise, fetch the full event list from the server
    handleChangedEvent(event: EventItem) {
        let index = this.state.eventList.findIndex(
            (eventInList: EventItem) => { return eventInList.id === event.id }
        )
        if (index == -1) {
            console.error("An event changed, but the event could not be found in the event list. Reloading the event list. eventId: " + event.id);
            this.fetchEventList(this.props);
            return;
        }

        this.setState(
            // Use immutability helpers to set this.state.eventList[index] = event
            update(this.state,
                { eventList: { $splice: [[index, 1, event]] } }
            )
        );
    }

    handleListGroupItemClick(key: string) {
        if (this.state.expandedEventId === key) {
            // If this item is already expanded, collapse it.
            this.setState({ expandedEventId: null });
        } else {
            this.setState({ expandedEventId: key })
        }
    }

    componentWillReceiveProps(props: Props) {
        if (props.filters != this.props.filters) {
            this.fetchEventList(props)
        }
    }

    applyFilter(eventItem: EventItem) {
        if (!this.props.filters) {
            return true;
        }

        let filters = this.props.filters;

        return (
            (!filters.hostUserId || filters.hostUserId === eventItem.hostId)
        );
    }

    // Returns a user's name formatted for display in the event list
    getUserName(user: UserItem): string {
        return user == null ? "" : user.firstName + " " + user.lastName
    }

    getLoggedInUserId(): string {
        return this.props.authState.loggedIn ? this.props.authState.user_id : ""
    }

    getIsUserAttending(event: EventItem): boolean {
        if (event.ticket && event.ticket.isAttending) {
            return true;
        }
        return false;
    }

    handleUpvote(event: EventItem) {
        if (!event.vote || event.vote.value < 1) {
            // The user clicked upvote on an event with a downvote or no vote
            EventService.upvote(event).then(
                (event: EventItem) => {
                    this.handleChangedEvent(event);
                }
            ).catch(
                (ex) => {
                    console.error("Error upvoting event: " + ex)
                }
                )
        } else {
            // The user clicked upvote on an event that was already upvoted, so clear the upvote
            EventService.novote(event).then(
                (event: EventItem) => {
                    this.handleChangedEvent(event);
                }
            ).catch(
                (ex) => {
                    console.error("Error clearing vote for event: " + ex)
                }
                )
        }
    }

    handleDownvote(event: EventItem) {
        if (!event.vote || event.vote.value > -1) {
            // The user clicked downvote on an event with an upvote or no vote
            EventService.downvote(event).then(
                (event: EventItem) => {
                    this.handleChangedEvent(event);
                }
            ).catch(
                (ex) => {
                    console.error("Error downvoting event: " + ex)
                }
                )
        } else {
            // The user clicked downvote on an event that was already downvoted, so clear the upvote
            EventService.novote(event).then(
                (event: EventItem) => {
                    this.handleChangedEvent(event);
                }
            ).catch(
                (ex) => {
                    console.error("Error clearing vote for event: " + ex)
                }
                )
        }
    }

    handleAttendingClick(event: EventItem) {
        if (!event.ticket) {
            if (event.totalCapacity - event.currentCapacity > 0) {
                // Get a ticket
                EventService.createTicket(event).then(
                    (event: EventItem) => {
                        this.handleChangedEvent(event);
                    }
                ).catch(
                    (ex) => {
                        console.error("Error creating ticket for event: " + ex)
                    }
                    )
            }
        } else {
            // Remove my ticket
            EventService.deleteTicket(event).then(
                (event: EventItem) => {
                    this.handleChangedEvent(event);
                }
            ).catch(
                (ex) => {
                    console.error("Error deleting ticket for event: " + ex)
                }
                )
        }
    }

    getListGroupItem(key: string, eventItem: EventItem) {
        if (this.applyFilter(eventItem)) {
            let isHostedByCurrentUser = eventItem.hostId === this.getLoggedInUserId();
            let isAttendedByCurrentUser = eventItem.ticket != null

            return <EventCard
                eventid={eventItem.id}
                title={eventItem.name}
                description={eventItem.description}
                host={this.getUserName(eventItem.host)}
                interest={eventItem.interestRating}
                time={eventItem.time}
                category={EventCategoryName.get(eventItem.category)}
                capacity={eventItem.totalCapacity}
                currentCapacity={eventItem.currentCapacity}
                vote={eventItem.vote ? eventItem.vote.value : 0}
                location={eventItem.location}
                handleUpvote={() => this.handleUpvote(eventItem)}
                handleDownvote={() => this.handleDownvote(eventItem)}
                isHostedByCurrentUser={isHostedByCurrentUser}
                isAttendedByCurrentUser={isAttendedByCurrentUser}
                handleAttendingClick={() => this.handleAttendingClick(eventItem)}
                handleRateClick={() => this.handleRateClick(eventItem)}
                reviewHostPrep={eventItem.reviewHostPrep}
                reviewMatchedDesc={eventItem.reviewMatchedDesc}
                reviewWouldReturn={eventItem.reviewWouldReturn}
            />;
        } else {
            return;
        }
    }

    renderFilterButton() {
        if (this.props.showFilterButton) {
            return <LinkContainer to="/events/filter"><Button>Filter</Button></LinkContainer>
        }
    }

    render() {
        var i: number = 0;
        let loading: JSX.Element = (this.state.loading) ? <div><i className="fa fa-circle-o-notch fa-spin fa-3x fa-fw"></i></div> : null;
        return (
            <div>
                {loading}
                <div className="event-list">
                    {this.state.eventList.map((event) => (<div>{this.getListGroupItem((i++).toString(), event)}</div>))}
                </div>
                <Modal show={this.state.showRateEvent} onHide={() => this.closeRateEventModal()}>
                    <Modal.Header closeButton>
                        <Modal.Title>Rate event</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <RateEvent handleSubmitRating={this.handleSubmitRating} />
                    </Modal.Body>
                </Modal>
            </div>
        );
    }
}