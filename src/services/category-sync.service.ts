import {injectable, /* inject, */ BindingScope} from '@loopback/core';
import {rabbitmqSubscribeDecorator} from '../decorators';
import {repository} from "@loopback/repository";
import {CategoryRepository} from "../repositories";

@injectable({scope: BindingScope.TRANSIENT})
export class CategorySyncService {
  constructor(
    @repository(CategoryRepository) private categoryRepo: CategoryRepository,
  ) {}

  @rabbitmqSubscribeDecorator({
    exchange: 'amq.topic',
    queue: 'x',
    routingKey: 'model.category.*'
  })
  handler({data}: {data: any}) {
    console.log(data)
  }

  @rabbitmqSubscribeDecorator({
    exchange: 'amq.topic',
    queue: 'x1',
    routingKey: 'model.category1.*'
  })
  handler2({data}: {data: any}) {
    console.log(data)
  }
}
