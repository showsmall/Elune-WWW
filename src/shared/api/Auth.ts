import CommonResp from "model/Resp";
import WebApi from "api/WebApi";
import UserInfo from "model/User";

export interface LoginReq {
    username: string;
    password: string;
}

export interface RegisterReq {
    username: string;
    email: string;
    password: string;
}

export interface ActivateReq {
    tokenSearch: string;
}

export interface ReActivateReq {
    email: string;
}

export function Login(payload: LoginReq) {
    return WebApi.Post<CommonResp<UserInfo>>("signin", payload);
}

export function Register(payload: RegisterReq) {
    return WebApi.Post<CommonResp<UserInfo>>("signup", payload);
}

export function Logout() {
    return WebApi.Post<CommonResp<{}>>("signout", {});
}

export function WhoAmI() {
    return WebApi.Post<CommonResp<UserInfo>>("user/me", {});
}

export function Activate(payload: ActivateReq) {
    return WebApi.Post<boolean>(`activate${payload.tokenSearch}`, {});
}

export function ReActivae(payload: ReActivateReq) {
    return WebApi.Post<boolean>("reactivate", payload);
}

export default {
    Login,
    Register,
    Logout
};
