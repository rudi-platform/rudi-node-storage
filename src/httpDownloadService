/**
 * An utility class operating a fast buffering management.
 * @class DownloadService
 */
export class DownloadService {
  constructor(chunkSize, fileSize) {
    this.chunkSize = chunkSize
    this.bufferSize = fileSize
    this.filecontent = Buffer.allocUnsafe(this.bufferSize)
    this.startts = new Date().valueOf()
    this.updateTime = 500
    this.realcontentsize = 0
  }
  read(req, update = null) {
    let chunk
    while (null !== (chunk = req.read())) {
      const nsize = this.realcontentsize + chunk.length
      if (nsize > this.bufferSize) {
        if (this.bufferSize > 2 * this.chunkSize) this.chunkSize *= 2
        this.bufferSize += this.chunkSize + chunk.length
        const newfilecontent = Buffer.allocUnsafe(this.bufferSize)
        this.filecontent.copy(newfilecontent)
        this.filecontent = newfilecontent
      }
      chunk.copy(this.filecontent, this.realcontentsize)
      this.realcontentsize += chunk.length
      if (update) {
        const currentts = new Date().valueOf()
        if (currentts - this.startts > this.updateTime) {
          update(this.realcontentsize)
          this.startts = new Date().valueOf()
        }
      }
    }
  }
  finish() {
    this.buffer_length = this.filecontent.length
    this.data = this.filecontent.subarray(0, this.realcontentsize)
    this.filecontent = null
    return this.data
  }
}
