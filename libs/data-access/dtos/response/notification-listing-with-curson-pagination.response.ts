import { BaseCursorPaginationResponse } from "@libs/data-access/base/base.response";
import { Notification } from "../../entities/notification.entity";
import { ObjectType } from "@nestjs/graphql";
import { NotificationGroup } from "./notification-group.response";

@ObjectType()
export class NotificationListWithCursorPaginationResponse extends BaseCursorPaginationResponse(NotificationGroup) {}