import { Producer } from "kafkajs";

class MediaServiceEventPublisher {

  constructor( private producer: Producer) {}

}

export default MediaServiceEventPublisher;