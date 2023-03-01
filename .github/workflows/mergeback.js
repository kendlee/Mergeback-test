module.exports = async({context, ...data}) => {
  console.log(data)
  console.log(JSON.stringify(context, null, 2))
}
