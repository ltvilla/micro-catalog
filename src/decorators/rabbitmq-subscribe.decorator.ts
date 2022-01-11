import {Options} from "amqplib";
import { MethodDecoratorFactory } from "@loopback/metadata";

export interface RabbitmqSubscribeMetaData {
  exchange: string;
  routingKey: string | string[];
  queue?: string;
  queueOptions?: Options.AssertQueue
}

export const RABBITMQ_SUBSCRIBE_DECORATOR = 'rabbitmq-subscribe-metada'

export function rabbitmqSubscribeDecorator(spec: RabbitmqSubscribeMetaData): MethodDecorator {
  return MethodDecoratorFactory.createDecorator<RabbitmqSubscribeMetaData>(
    RABBITMQ_SUBSCRIBE_DECORATOR, spec
  )
}