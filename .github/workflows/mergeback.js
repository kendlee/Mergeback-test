module.exports = async({context, ...data}) => {
  console.log(data)
  console.log(JSON.stringify(context, null, 2))
  console.log('PR ref', context.payload.pull_request?.head?.ref ?? 'none')
}
