import * as React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { UserService } from "../../services/user";

interface logoutProps {
    history?: { push(path: string): any }
}

class LogoutComponent extends React.Component<logoutProps, {}> {

    constructor(props: logoutProps) {
        super(props);
    }

    componentWillMount() {
        UserService.performLogOut();
        window.location.href = "/";
    }

    render () {
        return "";
    }
}

export const Logout = withRouter(LogoutComponent);