import {Application, CoreBindings, MetadataInspector, Server} from "@loopback/core";
import {Context, inject} from "@loopback/context";
import {Channel, ConfirmChannel, Options, Replies} from 'amqplib';
import {CategoryRepository} from "../repositories";
import {repository} from "@loopback/repository";
import {RabbitmqBindings} from "../keys";
import {AmqpConnectionManager, AmqpConnectionManagerOptions, ChannelWrapper, connect} from "amqp-connection-manager";
import {RABBITMQ_SUBSCRIBE_DECORATOR, RabbitmqSubscribeMetaData} from "../decorators";
import {Binding} from "@loopback/boot";

export interface RabbitmqConfig {
  uri: string;
  connOptions?: AmqpConnectionManagerOptions;
  exchanges?: {name: string, type: string, options?: Options.AssertExchange}[]
}

export class RabbitmqServer extends Context implements Server {
  private _listening: boolean;
  private _conn: AmqpConnectionManager;
  private _channelManager: ChannelWrapper
  channel: Channel;

  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE) public app: Application,
    @repository(CategoryRepository) private categoryRepo: CategoryRepository,
    @inject(RabbitmqBindings.CONFIG) private config: RabbitmqConfig
  ) {
    super(app);
  }

  async start(): Promise<void> {
    this._conn = connect([this.config.uri], this.config.connOptions)
    this._channelManager = this._conn.createChannel();
    this.channelManager.on('connect', () => {
      this._listening = true;
      console.log('Succesfully connected a Rabbitmq channel')
    });
    this.channelManager.on('error', (err, {name}) => {
      this._listening = false;
      console.log(`Failed to setup a Rabbitmq channel - name ${name} | error: ${err.message}`)
    });
    await this.setupExchanges();
    await this.bindSubscribers();
  }

  private async setupExchanges() {
    return this.channelManager.addSetup(async (channel: ConfirmChannel) => {
      if (!this.config.exchanges) {
        return;
      }

      await Promise.all(this.config.exchanges.map((exchange) => (
        channel.assertExchange(exchange.name, exchange.type, exchange.options)
      )))
    })
  }

  private async bindSubscribers() {
    this
      .getSubscribers()
      .map(async (item) => {
        await this.channelManager.addSetup(async (channel: ConfirmChannel) => {
          const {exchange, queue, routingKey, queueOptions} = item.metadata
          const assertQueue = await channel.assertQueue(
            queue ?? '',
            queueOptions ?? undefined
          )
          const routingKeys = Array.isArray(routingKey) ? routingKey : [routingKey]

          await Promise.all(
            routingKeys.map((x) => channel.bindQueue(assertQueue.queue, exchange, x))
          )
          await this.consume({
            channel,
            queue: assertQueue.queue,
            method: item.method
          });
        })
      })
  }

  private async consume({channel, queue, method}: {channel: ConfirmChannel, queue: string, method: Function}) {
    await channel.consume(queue, async message => {
      try {
        if (!message) {
          throw new Error('Received null message');
        }
        const content = message.content;
        if (content) {
          let data;
          try {
            data = JSON.parse(content.toString())
          } catch (e) {
            data = null;
          }
          console.log(data);
          await method({data, message, channel})
          channel.ack(message);
        }
      } catch (e) {
        console.error(e);
      //  politica de resposta
      }
    })
  }

  private getSubscribers(): {method: Function, metadata: RabbitmqSubscribeMetaData}[] {
    const bindings: Array<Readonly<Binding>> = this.find('services.*')
    return bindings.map(
      binding => {
        const metadata = MetadataInspector.getAllMethodMetadata<RabbitmqSubscribeMetaData>(
          RABBITMQ_SUBSCRIBE_DECORATOR, binding.valueConstructor?.prototype
        )
        if (!metadata) {
          return []
        }
        const methods = [];
        for(const methodName in metadata) {
          if (!Object.prototype.hasOwnProperty.call(metadata, methodName)) {
            return;
          }
          const service = this.getSync(binding.key) as any;
          methods.push({
            method: service[methodName].bind(service),
            metadata: metadata[methodName]
          })
        }
        return methods;
      }
    ).reduce((collection: any, item: any) => {
      collection.push(...item)
      return collection
    }, [])
  }
  //
  // async boot() {
  //   // @ts-ignore
  //   this.channel = await this.conn.createChannel();
  //   const queue: AssertQueue = await this.channel.assertQueue('micro-catalog/sync-videos');
  //   const exchange = await this.channel.assertExchange('amq.topic', 'topic');
  //   await this.channel.bindQueue(queue.queue, exchange.exchange, 'model.*.*');
  //
  //   this.channel.consume(queue.queue, (message) => {
  //     if (!message) {
  //       return;
  //     }
  //     const data = JSON.parse(message?.content.toString());
  //     const [model, event] = message.fields.routingKey.split('.').slice(1);
  //     this
  //       .sync({model, event, data})
  //       .then(() => this.channel.ack(message))
  //       .catch((error) => {
  //         console.log(error)
  //         this.channel.reject(message, false)
  //       })
  //   });
  // }
  //
  // async sync({model, event, data}: {model: string, event: string, data: Category}) {
  //   if (model === 'category') {
  //     switch (event) {
  //       case 'created':
  //         await this.categoryRepo.create({...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString()});
  //         break;
  //       case 'updated':
  //         await this.categoryRepo.updateById(data.id, data);
  //         break;
  //       case 'deleted':
  //         await this.categoryRepo.deleteById(data.id);
  //     }
  //   }
  // }

  async stop(): Promise<void> {
    this._listening = false
    await this.conn.close();
    return undefined;
  }

  get listening(): boolean {
    return this._listening;
  }

  get conn(): AmqpConnectionManager {
    return this._conn;
  }

  get channelManager(): ChannelWrapper {
    return this._channelManager;
  }
}